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

    constructor() {
        this.runnerId = process.env.RUNNER_ID || shortid.generate();
        this.commandsQueueName = 'mplay-runner-commands-' + this.runnerId;
        this.responsesQueueName = 'mplay-runner-responses-' + this.runnerId;
        this.errorsQueueName = 'mplay-runner-errors-' + this.runnerId;

        this.mongoShell = new MongoShell(this.runnerId, process.env.MONGODB_URL || 'localhost:27017', logger);
    }

    async start() {
        this.connection = await amqp.connect(process.env.AMQP_URL || 'amqp://localhost');
        this.channel = await this.connection.createChannel();
        if (!this.channel) {
            throw new Error('Channel not initialized')
        }
        await this.channel.assertQueue(this.commandsQueueName);
        await this.channel.assertQueue(this.responsesQueueName);
        await this.channel.assertQueue(this.errorsQueueName);
        await this.mongoShell.init();
        this.channel.consume(this.commandsQueueName, (message) => {
            if (message) {
                this.mongoShell.sendCommand({ in: message.content.toString() })
            }
        })
        this.mongoShell.stdout.on('data', (data) => {
            this.channel!.sendToQueue(this.responsesQueueName, Buffer.from(data))
        })
        this.mongoShell.stdout.on('error', (data) => {
            this.channel!.sendToQueue(this.errorsQueueName, Buffer.from(data as unknown as string))
        })
        logger.info('server started')
    }

    async listen() {
        return new Promise(() => {
            logger.info('server listenning')
        });
    }

    async stop() {
        if (this.connection) {
            this.connection.close()
        }
        await this.mongoShell.destroy();
    }
}
