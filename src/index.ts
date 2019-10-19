import * as amqp from 'amqplib';
import * as shortid from 'shortid';
import { MongoShell } from 'mongodb-shell';

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
        this.commandsQueueName = 'mplay-runner-commands';
        this.responsesQueueName = 'mplay-runner-responses';
        this.errorsQueueName = 'mplay-runner-errors';

        this.mongoShell = new MongoShell(this.runnerId, process.env.MONGODB_URL || 'localhost:27017');
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
        this.channel.consume(this.commandsQueueName, (messageBuffer) => {
            if (messageBuffer) {
                const message = JSON.parse(messageBuffer.content.toString())
                if(message.runnerId === this.runnerId) {
                    this.mongoShell.sendCommand({ in: message.command })
                }
            }
        })
        this.mongoShell.stdout.on('data', (data) => {
            const message = {
                data,
                runnerId: this.runnerId,
            }
            this.channel!.sendToQueue(this.responsesQueueName, Buffer.from(JSON.stringify(message)))
        })
        this.mongoShell.stdout.on('error', (data) => {
            const message = {
                data,
                runnerId: this.runnerId,
            }
            this.channel!.sendToQueue(this.errorsQueueName, Buffer.from(JSON.stringify(message) as unknown as string))
        })
        console.log('server started')
    }

    async listen() {
        return new Promise(() => {
            console.log('server listenning')
        });
    }

    async stop() {
        if (this.connection) {
            this.connection.close()
        }
        await this.mongoShell.destroy();
        console.log('server stoped')
    }
}
