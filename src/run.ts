import { Server } from '.'

async function run() {
 const server = new Server()
 await server.start();
 await server.listen();
}

run()