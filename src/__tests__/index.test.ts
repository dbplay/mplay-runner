import { Server } from '..'
import * as amqp from 'amqplib';
import * as shortid from 'shortid';

jest.mock('../logger')

describe('index', () => {

    let server: Server;
    let channel: amqp.Channel;
    let connection: amqp.Connection;
    let queue: string;

    beforeAll(async () => {
        // connection = await amqp.connect('amqp://localhost');
        // channel = await connection.createChannel();
    })


    beforeEach(async () => {
        queue = 'queueName' + shortid();
        connection = await amqp.connect('amqp://localhost');
        channel = await connection.createChannel();
        server = new Server();
        await channel.deleteQueue(server.commandsQueueName)
        await channel.deleteQueue(server.responsesQueueName)
        await channel.deleteQueue(server.errorsQueueName)
        await channel.deleteExchange(server.exchangeName)
        await channel.deleteExchange(server.exchangeReponseName)
        await channel.deleteQueue(queue)

        await channel.assertQueue(queue);
        await server.start();
    })

    afterEach(async () => {
        connection.close()

        await server.stop()
    })

    it('can send and receive commands result throw rabbit', async (done) => {

        await channel.bindQueue(queue, server.exchangeReponseName, server.runnerId);

        channel.consume(queue, (message) => {
            if (message) {
                const jsonMessage = JSON.parse(message.content.toString())
                expect(jsonMessage.data).toMatch('WriteResult({ "nInserted" : 1 })')
                expect(jsonMessage.runnerId).toBe(server.runnerId)
                expect(jsonMessage.type).toBe('SUCCESS')
                done()
            }
        })
        channel.publish(server.exchangeName, server.runnerId, Buffer.from(JSON.stringify({ runnerId: server.runnerId, command: 'db.toto.insert({titi: 7})' })))
    })

    it('can send and receive commands errors throw rabbit', async (done) => {
        await channel.bindQueue(queue, server.exchangeReponseName, server.runnerId);

        channel.consume(queue, (message) => {
            if (message) {
                const jsonMessage = JSON.parse(message.content.toString())
                expect(jsonMessage.data).toMatch('ReferenceError: martinealaplage is not defined')
                expect(jsonMessage.runnerId).toBe(server.runnerId)
                expect(jsonMessage.type).toBe('ERROR')
                done()
            }
        })
        channel.publish(server.exchangeName, server.runnerId, Buffer.from(JSON.stringify({ runnerId: server.runnerId, command: 'martinealaplage' })))
    })


    it('does not handle events from other runners', async (done) => {
        await channel.bindQueue(queue, server.exchangeReponseName, server.runnerId);
        let received = 0;
        channel.consume(queue, (message) => {
            if (message) {
                received += 1;
                setTimeout(() => {  // once we received the first response, we let 100ms to the runner to potentially handle the command
                    expect(received).toBe(1)
                    done()
                }, 100)
            }
        })
        channel.publish(server.exchangeName, 'otherRunner', Buffer.from(JSON.stringify({ runnerId: 'otherRunner', command: 'db.toto.insert({titi: 7})' })))
        channel.publish(server.exchangeName, server.runnerId, Buffer.from(JSON.stringify({ runnerId: server.runnerId, command: 'db.toto.insert({titi: 7})' })))
    })

    it('it sends response to all consumers', async (done) => {
        await channel.bindQueue(queue, server.exchangeReponseName, server.runnerId);
        const otherQueue = queue + '2'
        await channel.assertQueue(otherQueue);
        await channel.bindQueue(otherQueue, server.exchangeReponseName, server.runnerId);
        let received = 0;
        channel.consume(queue, (message) => {
            if (message) {
                received += 1;
                if (received === 2) {
                    done()
                }
            }
        })
        channel.consume(otherQueue, (message) => {
            received += 1;
            if (received === 2) {
                done()
            }
        })
        channel.publish(server.exchangeName, server.runnerId, Buffer.from(JSON.stringify({ runnerId: server.runnerId, command: 'db.toto.insert({titi: 7})' })))
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
            await channel.bindQueue(queue, server.exchangeReponseName, server3.runnerId);
            channel.consume(queue, (message) => {
                if (message) {
                    done()
                }
            })
            channel.publish(server.exchangeName, server3.runnerId, Buffer.from(JSON.stringify({ runnerId: server3.runnerId, command: 'db.toto.insert({titi: 7})' })))
        })
        afterEach(async () => {
            await server2.stop()
            await server3.stop()
            await server4.stop()
        })
    })


})