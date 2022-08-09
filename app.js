var express = require('express');
var axios = require('axios');
var amqp = require('amqplib');
require('dotenv').config();

var app = express();
app.get('/test/users', async function (req, res) {
    // Get users from endpoint
    let response = await axios.get('https://jsonplaceholder.typicode.com/users');
    let users = response.data;

    // Delete property address from lis of users
    users.forEach(user => delete user.address);

    // Sort the list of user in descending order
    users.sort((userA, userB) => userB.id - userA.id);

    // Public on RabbitMQ user that your id is an even number on exchange "users" of fanout type that have to be binded with queue "users-requested"
    let userToSend = users.filter(user => user.id % 2 === 0);

    amqp.connect(process.env.RABBITMQ_URI)
        .then(connection => connection.createChannel())
        .then(channel => {
            Promise.all([
                channel.assertExchange('users', 'fanout', { durable: true }),
                channel.assertQueue('users-requested', { durable: true }),
                channel.bindQueue('users-requested', 'users', '')
            ]).then(async () => {
                console.log(userToSend.length);
                for (const user of userToSend) {
                    try {
                        await channel.publish('users', '', Buffer.from(JSON.stringify(user)));
                        console.log(`Mensaje de usuario con id ${user.id} ha sido enviado con éxito`);
                    } catch (error) {
                        console.error(`Se ha producido un error al enviar el mensaje del usuario con id ${user.id}`, error)
                    }
                }
            })
        })
        .catch((error) => {
            console.error('Se ha producido un error');
            console.error(error);
        });
    res.send(users);
});
app.listen(3333, function () {
    console.log('Example app listening on port 3333!');
});