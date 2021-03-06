import * as amqp from 'amqplib';
import * as shortid from 'shortid';
import { MongoShell } from 'mongodb-shell';
import { logger } from './logger';

export class Server {

    private connection?: amqp.Connection;
    private channel?: amqp.Channel;
    private mongoShell: MongoShell;
    public readonly runnerId: string;
    public readonly commandsQueueName: string;
    public readonly responsesQueueName: string;
    public readonly errorsQueueName: string;
    public readonly exchangeName: string;
    public readonly exchangeReponseName: string;

    constructor() {
        this.runnerId = process.env.RUNNER_ID || shortid.generate();
        this.commandsQueueName = 'mplay-runner-commands';
        this.responsesQueueName = 'mplay-runner-responses';
        this.errorsQueueName = 'mplay-runner-errors';
        this.exchangeName = 'mplay-ex';
        this.exchangeReponseName = 'mplay-response-exchange';

        this.mongoShell = new MongoShell(this.runnerId, process.env.MONGODB_URL || 'localhost:27017', logger);
    }

    async start() {
        this.connection = await amqp.connect(process.env.AMQP_URL || 'amqp://localhost');
        this.channel = await this.connection.createChannel();
        if (!this.channel) {
            throw new Error('Channel not initialized')
        }
        await this.channel.assertExchange(this.exchangeName, 'direct', { durable: false })
        await this.channel.assertExchange(this.exchangeReponseName, 'fanout', { durable: false })
        const commandsQueue = await this.channel.assertQueue(this.commandsQueueName + '-' + this.runnerId, {
            exclusive: true,
        });
        await this.channel.bindQueue(commandsQueue.queue, this.exchangeName, this.runnerId);

        await this.channel.assertQueue(this.responsesQueueName);
        await this.channel.assertQueue(this.errorsQueueName);


        await this.mongoShell.init();
        await this.channel.consume(commandsQueue.queue, (messageBuffer) => {
            if (messageBuffer) {
                const message = JSON.parse(messageBuffer.content.toString())
                logger.debug(`received a message for us (${this.runnerId}) : ${message.command}`)
                this.mongoShell.sendCommand({ in: message.command })
            }
        }, { noAck: true })
        logger.info(`${this.runnerId} consuming ${this.exchangeName} on queue ${commandsQueue.queue}`)

        this.mongoShell.stdout.on('data', (data) => {
            const message = {
                data,
                runnerId: this.runnerId,
                type: 'SUCCESS',
            }
            logger.debug(`sending out`, message)
            this.channel!.publish(this.exchangeReponseName, this.runnerId, Buffer.from(JSON.stringify(message)))
        })
        this.mongoShell.stdout.on('error', (data) => {
            const message = {
                data,
                runnerId: this.runnerId,
                type: 'ERROR',
            }
            logger.debug(`sending error`, message)
            this.channel!.publish(this.exchangeReponseName, this.runnerId, Buffer.from(JSON.stringify(message)))
        })
        logger.info('server started')
    }

    async listen() {
        return new Promise(() => {
            logger.info('server listenning')
        });
    }

    async stop() {
        if (this.channel) {
            await this.channel.deleteQueue(this.commandsQueueName + '-' + this.runnerId)
        }
        if (this.connection) {
            this.connection.close()
        }
        await this.mongoShell.destroy();
        logger.info('server stoped')
    }
}
