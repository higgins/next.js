import { createNextDescribe } from 'e2e-utils'
import { fetchViaHTTP, normalizeRouteRegExes } from 'next-test-utils'
import cheerio from 'cheerio'
import { join } from 'path'
import escapeStringRegexp from 'escape-string-regexp'
import fs from 'fs-extra'

createNextDescribe(
  'edge-render-getserversideprops',
  {
    files: join(__dirname, 'app'),
  },
  ({ next }) => {
    if ((global as any).isNextStart) {
      it('should not output trace files for edge routes', async () => {
        expect(await fs.pathExists(join(next.testDir, '.next/pages'))).toBe(
          false
        )
        expect(
          await fs.pathExists(join(next.testDir, '.next/server/pages/[id].js'))
        ).toBe(true)
        expect(
          await fs.pathExists(
            join(next.testDir, '.next/server/pages/[id].js.nft.json')
          )
        ).toBe(false)
        expect(
          await fs.pathExists(join(next.testDir, '.next/server/pages/index.js'))
        ).toBe(true)
        expect(
          await fs.pathExists(
            join(next.testDir, '.next/server/pages/index.js.nft.json')
          )
        ).toBe(false)
      })
    }

    it('should have correct query for pages/api', async () => {
      const res = await fetchViaHTTP(next.url, '/api/hello', { a: 'b' })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        hello: 'world',
        query: {
          a: 'b',
        },
      })
    })

    it('should have correct query for pages/api dynamic', async () => {
      const res = await fetchViaHTTP(next.url, '/api/id-1', { a: 'b' })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        hello: 'again',
        query: {
          a: 'b',
          id: 'id-1',
        },
      })
    })

    it('should have correct query/params on index', async () => {
      const res = await fetchViaHTTP(next.url, '/')
      expect(res.status).toBe(200)
      const html = await res.text()
      const $ = cheerio.load(html)
      expect($('#page').text()).toBe('/index')
      const props = JSON.parse($('#props').text())
      expect(props.query).toEqual({})
      expect(props.params).toBe(null)
      expect(props.url).toBe('/')
    })

    it('should have correct query/params on /[id]', async () => {
      const res = await fetchViaHTTP(next.url, '/123', { hello: 'world' })
      expect(res.status).toBe(200)
      const html = await res.text()
      const $ = cheerio.load(html)
      expect($('#page').text()).toBe('/[id]')
      const props = JSON.parse($('#props').text())
      expect(props.query).toEqual({ id: '123', hello: 'world' })
      expect(props.params).toEqual({ id: '123' })
      expect(props.url).toBe('/123?hello=world')
    })

    it('should have correct query/params on rewrite', async () => {
      const res = await fetchViaHTTP(next.url, '/rewrite-me', {
        hello: 'world',
      })
      expect(res.status).toBe(200)
      const html = await res.text()
      const $ = cheerio.load(html)
      expect($('#page').text()).toBe('/index')
      const props = JSON.parse($('#props').text())
      expect(props.query).toEqual({ hello: 'world' })
      expect(props.params).toEqual(null)
      expect(props.url).toBe('/rewrite-me?hello=world')
    })

    it('should have correct query/params on dynamic rewrite', async () => {
      const res = await fetchViaHTTP(next.url, '/rewrite-me-dynamic', {
        hello: 'world',
      })
      expect(res.status).toBe(200)
      const html = await res.text()
      const $ = cheerio.load(html)
      expect($('#page').text()).toBe('/[id]')
      const props = JSON.parse($('#props').text())
      expect(props.query).toEqual({ id: 'first', hello: 'world' })
      expect(props.params).toEqual({ id: 'first' })
      expect(props.url).toBe('/rewrite-me-dynamic?hello=world')
    })

    it('should respond to _next/data for index correctly', async () => {
      const res = await fetchViaHTTP(
        next.url,
        `/_next/data/${next.buildId}/index.json`,
        undefined,
        {
          headers: {
            'x-nextjs-data': '1',
          },
        }
      )
      expect(res.status).toBe(200)
      const { pageProps: props } = await res.json()
      expect(props.query).toEqual({})
      expect(props.params).toBe(null)
    })

    it('should respond to _next/data for [id] correctly', async () => {
      const res = await fetchViaHTTP(
        next.url,
        `/_next/data/${next.buildId}/321.json`,
        { hello: 'world' },
        {
          headers: {
            'x-nextjs-data': '1',
          },
        }
      )
      expect(res.status).toBe(200)
      const { pageProps: props } = await res.json()
      expect(props.query).toEqual({ id: '321', hello: 'world' })
      expect(props.params).toEqual({ id: '321' })
    })

    if ((global as any).isNextStart) {
      it('should have data routes in routes-manifest', async () => {
        const manifest = JSON.parse(
          await next.readFile('.next/routes-manifest.json')
        )

        for (const route of manifest.dataRoutes) {
          normalizeRouteRegExes(route)
        }

        expect(manifest.dataRoutes).toEqual(
          [
            {
              dataRouteRegex: `^/_next/data/${escapeStringRegexp(
                next.buildId
              )}/index.json$`,
              page: '/',
            },
            {
              dataRouteRegex: `^/_next/data/${escapeStringRegexp(
                next.buildId
              )}/([^/]+?)\\.json$`,
              namedDataRouteRegex: `^/_next/data/${escapeStringRegexp(
                next.buildId
              )}/(?<nxtPid>[^/]+?)\\.json$`,
              page: '/[id]',
              routeKeys: {
                nxtPid: 'nxtPid',
              },
            },
          ].map((item) => normalizeRouteRegExes(item))
        )
      })
    }
  }
)
