import { Server } from '..'
import * as amqp from 'amqplib';

describe('index', () => {

    let server: Server;
    let channel: amqp.Channel;
    let connection: amqp.Connection;

    beforeEach(async () => {
        server = new Server();
        await server.start();
        connection = await amqp.connect('amqp://localhost');
        channel = await connection.createChannel();
        await channel.assertQueue(server.commandsQueueName);
        await channel.assertQueue(server.responsesQueueName);
        await channel.assertQueue(server.errorsQueueName);
    })

    afterEach(async () => {
        await server.stop()
        connection.close()
    })
    it('can send and receive commands result throw rabbit', async (done) => {
        channel.sendToQueue(server.commandsQueueName, Buffer.from('db.toto.insert({titi: 7})'))
        channel.consume(server.responsesQueueName, (message) => {
            expect(message!.content.toString()).toMatch('WriteResult({ "nInserted" : 1 })')
            done()
        })
        channel.consume(server.errorsQueueName, (message) => {
            done(message)
        })
    })

    it('can send and receive commands errors throw rabbit', async (done) => {
        channel.sendToQueue(server.commandsQueueName, Buffer.from('martinealaplage'))
        channel.consume(server.responsesQueueName, () => {
            done('should be an error')
        })
        channel.consume(server.errorsQueueName, (message) => {
            expect(message!.content.toString()).toMatch('ReferenceError: martinealaplage is not defined')
            done()
        })
    })
})