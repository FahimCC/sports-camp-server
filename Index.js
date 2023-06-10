const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

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

		//jwt
		app.post('/jwt', (req, res) => {
			const user = req.body;
			const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
				expiresIn: '1h',
			});
			res.send({ token });
		});

		//users
		app.get('/users', async (req, res) => {
			const result = await userCollection.find().toArray();
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
