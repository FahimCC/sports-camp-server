const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

//middleware
app.use(cors());

app.get('/', (req, res) => {
	res.send('Sports Match is running...');
});

app.listen(port, () => {
	console.log(`Sports match is running on port: ${port}`);
});
