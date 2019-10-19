import { Server } from '..'
import * as amqp from 'amqplib';

describe('index', () => {

    let server: Server;
    let channel: amqp.Channel;
    let connection: amqp.Connection;

    beforeAll(async () => {
        // connection = await amqp.connect('amqp://localhost');
        // channel = await connection.createChannel();
    })

    beforeEach(async () => {
        connection = await amqp.connect('amqp://localhost');
        channel = await connection.createChannel();
        server = new Server();
        await channel.deleteQueue(server.commandsQueueName)
        // await channel.assertQueue(server.commandsQueueName);
        await channel.deleteQueue(server.responsesQueueName)
        // await channel.assertQueue(server.responsesQueueName);
        await channel.deleteQueue(server.errorsQueueName)
        // await channel.assertQueue(server.errorsQueueName);
        await server.start();
    })

    afterEach(async () => {
        connection.close()
        await server.stop()
    })

    afterAll(() => {
    })
    it('can send and receive commands result throw rabbit', async (done) => {
        channel.consume(server.responsesQueueName, (message) => {
            const jsonMessage = JSON.parse(message!.content.toString())
            expect(jsonMessage.data).toMatch('WriteResult({ "nInserted" : 1 })')
            expect(jsonMessage.runnerId).toBe(server.runnerId)
            done()
        })
        channel.consume(server.errorsQueueName, (message) => {
            done(message)
        })
        channel.sendToQueue(server.commandsQueueName, Buffer.from(JSON.stringify({ runnerId: server.runnerId, command: 'db.toto.insert({titi: 7})' })))
    })

    it('can send and receive commands errors throw rabbit', async (done) => {
        channel.consume(server.responsesQueueName, () => {
            done('should be an error')
        })
        channel.consume(server.errorsQueueName, (message) => {
            const jsonMessage = JSON.parse(message!.content.toString())
            expect(jsonMessage.data).toMatch('ReferenceError: martinealaplage is not defined')
            expect(jsonMessage.runnerId).toBe(server.runnerId)
            done()
        })
        channel.sendToQueue(server.commandsQueueName, Buffer.from(JSON.stringify({ runnerId: server.runnerId, command: 'martinealaplage' })))
    })

    it('does not handle events from other runners', async (done) => {
        let received = 0;
        channel.consume(server.responsesQueueName, (message) => {
            received += 1;
            setTimeout(() => {  // once we received the first response, we let 100ms to the runner to potentially handle the command
                expect(received).toBe(1)
                done()
            }, 100)
        })
        channel.consume(server.errorsQueueName, (message) => {
            done(message)
        })
        channel.sendToQueue(server.commandsQueueName, Buffer.from(JSON.stringify({ runnerId: 'otherRunner', command: 'db.toto.insert({titi: 7})' })))
        channel.sendToQueue(server.commandsQueueName, Buffer.from(JSON.stringify({ runnerId: server.runnerId, command: 'db.toto.insert({titi: 7})' })))
        
    })
})