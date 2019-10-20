import { Server } from '..'
import * as amqp from 'amqplib';

jest.mock('../logger')

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
        await channel.deleteExchange(server.exchangeName)
        // await channel.assertQueue(server.errorsQueueName);
        await server.start();
    })

    afterEach(async () => {
        connection.close()
        await server.stop()
    })

    it('can send and receive commands result throw rabbit', async (done) => {
        const exchange = await channel.assertExchange(server.exchangeName, 'direct', {durable: false})

        channel.consume(server.responsesQueueName, (message) => {
            const jsonMessage = JSON.parse(message!.content.toString())
            expect(jsonMessage.data).toMatch('WriteResult({ "nInserted" : 1 })')
            expect(jsonMessage.runnerId).toBe(server.runnerId)
            done()
        })
        channel.consume(server.errorsQueueName, (message) => {
            done(message)
        })
        channel.publish(exchange.exchange, server.runnerId, Buffer.from(JSON.stringify({ runnerId: server.runnerId, command: 'db.toto.insert({titi: 7})' })))
    })

    it('can send and receive commands errors throw rabbit', async (done) => {
        const exchange = await channel.assertExchange(server.exchangeName, 'direct', {durable: false})

        channel.consume(server.responsesQueueName, () => {
            done('should be an error')
        })
        channel.consume(server.errorsQueueName, (message) => {
            const jsonMessage = JSON.parse(message!.content.toString())
            expect(jsonMessage.data).toMatch('ReferenceError: martinealaplage is not defined')
            expect(jsonMessage.runnerId).toBe(server.runnerId)
            done()
        })
        channel.publish(exchange.exchange, server.runnerId, Buffer.from(JSON.stringify({ runnerId: server.runnerId, command: 'martinealaplage' })))
    })

    it('does not handle events from other runners', async (done) => {
        const exchange = await channel.assertExchange(server.exchangeName, 'direct', {durable: false})

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
        channel.publish(exchange.exchange, 'otherRunner', Buffer.from(JSON.stringify({ runnerId: 'otherRunner', command: 'db.toto.insert({titi: 7})' })))
        channel.publish(exchange.exchange, server.runnerId,Buffer.from(JSON.stringify({ runnerId: server.runnerId, command: 'db.toto.insert({titi: 7})' })))
        
    })

    describe('broadcast', () => {
        const server2 = new Server();
        const server3 = new Server();
        const server4 = new Server();

        beforeEach(async () => {
            await server2.start();
            await server3.start();
            await server4.start();
        })

        it('receive all messages', async (done) => {
            const exchange = await channel.assertExchange(server.exchangeName, 'direct', {durable: false})
            channel.consume(server.responsesQueueName, () => {
                done()
            })
            channel.consume(server.errorsQueueName, (message) => {
                done(message)
            })
            channel.publish(exchange.exchange, server3.runnerId, Buffer.from(JSON.stringify({ runnerId: server3.runnerId, command: 'db.toto.insert({titi: 7})' })))
            
        })

        afterEach(async () => {
            await server2.stop()
            await server3.stop()
            await server4.stop()
        })
    })

    
})