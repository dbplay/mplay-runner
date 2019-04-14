const micro = require('micro')
const request = require('request-promise')
const listen = require('test-listen')
const handler = require('../index')

describe('index', () => {
    let service;
    let url;

    afterEach(() => {
        service.close()
    })

    afterAll(() => {
        handler.close()
    })

    it('creates a new shell and send command to it on a new command', async () => {
        service = micro(handler)
         url = await listen(service)
        const body = { command: "foo=5" }
        const res = await request.post({ url, body, json: true })
        expect(res).toEqual({ out: '5', status: 'SUCCESS' })
    })

    it('reuse the previous shell', async () => {
        service = micro(handler)
         url = await listen(service)
         const body1 = { command: "foo=5" }
         const res1 = await request.post({ url, body: body1, json: true })
         expect(res1).toEqual({ out: '5', status: 'SUCCESS' })
        const body2 = { command: "foo" }
        const res2 = await request.post({ url, body: body2, json: true })
        expect(res2).toEqual({ out: '5', status: 'SUCCESS' })
    })
})