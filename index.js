const {json, send} = require('micro')

const { MongoShell } = require('mongodb-shell');
const mongoShell = new MongoShell(process.env.MONGODB_URL || 'localhost:27017');

module.exports = async (req, res) => {
    const payload = await json(req)
    const commandOutput = await mongoShell.sendCommand({ in: payload.command });
    send(res, 200, commandOutput)
}

module.exports.close = () => {
    mongoShell.destroy();
}