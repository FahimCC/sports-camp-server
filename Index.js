const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_PAYMENT_API);

const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
	const authorization = req.headers.authorization;

	if (!authorization) {
		return res
			.status(401)
			.send({ error: true, message: 'Unauthorized access' });
	}
	const token = authorization.split(' ')[1];

	jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
		if (err) {
			return res
				.status(401)
				.send({ error: true, message: 'Unauthorized access' });
		}
		req.decoded = decoded;
		next();
	});
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ws55k5x.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		// await client.connect();

		const userCollection = client.db('sportsCamp').collection('users');
		const classCollection = client.db('sportsCamp').collection('classes');
		const selectedClassCollection = client
			.db('sportsCamp')
			.collection('selectedClasses');
		const paymentCollection = client.db('sportsCamp').collection('payments');

		//verifyAdmin
		const verifyAdmin = async (req, res, next) => {
			const email = req.decoded.email;
			const query = { email: email };
			const user = await userCollection.findOne(query);
			if (user.role !== 'admin') {
				return res
					.status(403)
					.send({ error: true, message: 'Forbidden Access' });
			}
			next();
		};
		//verifyInstructor
		const verifyInstructor = async (req, res, next) => {
			const email = req.decoded.email;
			const query = { email: email };
			const user = await userCollection.findOne(query);
			if (user.role !== 'instructor') {
				return res
					.status(403)
					.send({ error: true, message: 'Forbidden Access' });
			}
			next();
		};

		//jwt
		app.post('/jwt', (req, res) => {
			const user = req.body;
			const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
				expiresIn: '1h',
			});
			res.send({ token });
		});

		//select class
		app.post('/select-class', verifyJWT, async (req, res) => {
			const selectedClass = req.body;
			const query = { className: selectedClass.className };
			const existsClass = await selectedClassCollection.findOne(query);
			if (existsClass) {
				return res.send({ message: 'Class already added' });
			}
			const result = await selectedClassCollection.insertOne(selectedClass);
			res.send(result);
		});
		app.get('/select-class', verifyJWT, async (req, res) => {
			const info = req.query;
			const query = {
				studentEmail: info.email,
				paymentStatus: info.paymentStatus,
			};
			const result = await selectedClassCollection.find(query).toArray();
			res.send(result);
		});
		app.delete('/select-class/:id', verifyJWT, async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await selectedClassCollection.deleteOne(query);
			res.send(result);
		});
		app.get('/remove-select-class/:id', verifyJWT, async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await selectedClassCollection.findOne(query);
			res.send(result);
		});
		app.patch('/select-class/:id', verifyJWT, async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const updateDoc = {
				$set: {
					paymentStatus: 'paid',
				},
			};
			const result = await selectedClassCollection.updateOne(query, updateDoc);
			res.send(result);
		});

		//users
		app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
			const result = await userCollection.find().toArray();
			res.send(result);
		});
		app.get('/instructors', async (req, res) => {
			const query = { role: 'instructor' };
			const result = await userCollection.find(query).toArray();
			res.send(result);
		});
		app.post('/users', async (req, res) => {
			const user = req.body;
			const query = { email: user.email };
			const existsUser = await userCollection.findOne(query);

			if (existsUser) {
				return res.send({ message: 'user already exists.' });
			}
			user.role = 'student';
			const result = await userCollection.insertOne(user);
			res.send(result);
		});

		app.get('/users/admin/:email', verifyJWT, async (req, res) => {
			const email = req.params.email;

			if (req.decoded?.email !== email) {
				res.send({ admin: false });
			}

			const query = { email: email };
			const user = await userCollection.findOne(query);
			const result = { admin: user.role === 'admin' };
			res.send(result);
		});
		app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
			const email = req.params.email;

			if (req.decoded?.email !== email) {
				res.send({ instructor: false });
			}

			const query = { email: email };
			const user = await userCollection.findOne(query);
			const result = { instructor: user?.role === 'instructor' };
			res.send(result);
		});

		app.patch('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
			const id = req.params.id;
			const filter = { _id: new ObjectId(id) };
			const updateDoc = {
				$set: {
					role: 'admin',
				},
			};
			const result = await userCollection.updateOne(filter, updateDoc);
			res.send(result);
		});
		app.patch('/users/instructor/:id', async (req, res) => {
			const id = req.params.id;
			const filter = { _id: new ObjectId(id) };
			const updateDoc = {
				$set: {
					role: 'instructor',
				},
			};
			const result = await userCollection.updateOne(filter, updateDoc);
			res.send(result);
		});

		//class
		//Add Class
		app.post('/add-class', verifyJWT, verifyInstructor, async (req, res) => {
			const newClass = req.body;
			newClass.status = 'pending';
			newClass.feedback = 'none';
			const result = await classCollection.insertOne(newClass);
			res.send(result);
		});

		//my-classes
		app.get(
			'/my-classes/:email',
			verifyJWT,
			verifyInstructor,
			async (req, res) => {
				const email = req.params.email;
				const query = { instructorEmail: email };
				const result = await classCollection.find(query).toArray();
				res.send(result);
			}
		);
		app.get(
			'/my-classes/:email',
			verifyJWT,
			verifyInstructor,
			async (req, res) => {
				const email = req.params.email;
				const query = { instructorEmail: email };
				const result = await classCollection.find(query).toArray();
				res.send(result);
			}
		);
		app.get(
			'/update-class/:id',
			verifyJWT,
			verifyInstructor,
			async (req, res) => {
				const id = req.params.id;
				const query = { _id: new ObjectId(id) };
				const result = await classCollection.findOne(query);
				res.send(result);
			}
		);
		app.patch(
			'/update-class/:id',
			verifyJWT,
			verifyInstructor,
			async (req, res) => {
				const id = req.params.id;
				const classInfo = req.body;
				const query = { _id: new ObjectId(id) };
				const updateDoc = {
					$set: {
						availableSeat: classInfo.availableSeat,
						price: classInfo.price,
					},
				};
				const result = await classCollection.updateOne(query, updateDoc);
				res.send(result);
			}
		);
		app.get('/my-classes', verifyJWT, verifyAdmin, async (req, res) => {
			const result = await classCollection.find().toArray();
			res.send(result);
		});
		app.get('/classes/approved', async (req, res) => {
			const query = { status: 'approved' };
			const result = await classCollection.find(query).toArray();
			res.send(result);
		});
		app.patch('/my-classes/:id', verifyJWT, verifyAdmin, async (req, res) => {
			const id = req.params.id;
			const { status } = req.body;
			const query = { _id: new ObjectId(id) };
			const updateDoc = {
				$set: {
					status: status,
				},
			};
			const result = await classCollection.updateOne(query, updateDoc);
			res.send(result);
		});
		app.patch(
			'/my-classes-feedback/:id',
			verifyJWT,
			verifyAdmin,
			async (req, res) => {
				const id = req.params.id;
				const { feedback } = req.body;
				const query = { _id: new ObjectId(id) };
				const updateDoc = {
					$set: {
						feedback: feedback,
					},
				};
				const result = await classCollection.updateOne(query, updateDoc);
				res.send(result);
			}
		);

		//payment
		app.post('/create-payment-intent', verifyJWT, async (req, res) => {
			const { price } = req.body;
			const amount = price * 100;

			const paymentIntent = await stripe.paymentIntents.create({
				amount: amount,
				currency: 'usd',
				payment_method_types: ['card'],
			});
			res.send({ clientSecret: paymentIntent.client_secret });
		});

		app.post('/payment', async (req, res) => {
			const paymentDetails = req.body;
			const result = await paymentCollection.insertOne(paymentDetails);
			res.send(result);
		});
		app.get('/payment', async (req, res) => {
			const result = await paymentCollection
				.find()
				.sort({ date: -1 })
				.toArray();
			res.send(result);
		});

		// Send a ping to confirm a successful connection
		await client.db('admin').command({ ping: 1 });

		console.log(
			'Pinged your deployment. You successfully connected to MongoDB!'
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);

app.get('/', (req, res) => {
	res.send('Sports Match is running...');
});

app.listen(port, () => {
	console.log(`Sports match is running on port: ${port}`);
});
