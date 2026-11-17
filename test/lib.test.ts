import { test } from "node:test"
import assert from "node:assert/strict"
import {
  API_URL,
  HttpRequest,
  createDraft,
  isApiKey,
  keyPreview,
  keyWorkspace,
  markupToText,
  productLink,
  productToText,
  productUrlProblem,
  publicImageUrl,
  shorten,
  uploadImage,
} from "../src/modules/solmarrow/lib.ts"
import SolMarrowModuleService from "../src/modules/solmarrow/service.ts"

const KEY = "smk_abcdefghijklmnopqrstuvwxyz012345"
const WS = "11111111-2222-3333-4444-555555555555"

test("api key format and preview", () => {
  assert.equal(isApiKey(KEY), true)
  assert.equal(isApiKey("abc"), false)
  assert.equal(isApiKey("smk_short"), false)
  assert.equal(keyPreview(KEY), "smk_…2345")
})

test("product url template", () => {
  assert.equal(productUrlProblem(""), null)
  assert.equal(productUrlProblem("https://shop.example.com/products/{handle}"), null)
  assert.match(productUrlProblem("http://shop.example.com/{handle}")!, /https/)
  assert.match(productUrlProblem("https://shop.example.com/{slug}")!, /placeholders/)
  assert.equal(productLink("https://shop.example.com/products/{handle}", { id: "prod_1", handle: "blue shirt" }), "https://shop.example.com/products/blue%20shirt")
  assert.equal(productLink("https://shop.example.com/p/{id}", { id: "prod_1" }), "https://shop.example.com/p/prod_1")
  assert.equal(productLink("https://shop.example.com/products/{handle}", { id: "prod_1", handle: "" }), null)
  assert.equal(productLink(undefined, { id: "prod_1", handle: "x" }), null)
  assert.equal(productLink("ftp://bad/{handle}", { id: "prod_1", handle: "x" }), null)
})

test("markup and shorten", () => {
  assert.equal(markupToText("<p>Soft <b>cotton</b> &amp; linen</p><p>Two</p>"), "Soft cotton & linen\n\nTwo")
  assert.equal(markupToText("**Bold** and [link](https://x.y)"), "Bold and link")
  const long = "word ".repeat(100)
  const s = shorten(long, 50)
  assert.ok(s.length <= 50 && s.endsWith("…"))
})

test("product to text", () => {
  const p = { id: "prod_1", title: "Blue Shirt", subtitle: "Organic cotton", description: "<p>Long text</p>", handle: "blue-shirt" }
  assert.deepEqual(productToText(p, "https://shop.example.com/products/{handle}"), {
    text: "Blue Shirt\n\nOrganic cotton\n\nhttps://shop.example.com/products/blue-shirt",
    link: "https://shop.example.com/products/blue-shirt",
  })
  assert.equal(productToText({ id: "p", title: "Mug", description: "<p>A <i>big</i> mug</p>" }).text, "Mug\n\nA big mug")
  assert.equal(productToText({ id: "p", title: "Mug", subtitle: "Mug" }).text, "Mug")
  assert.equal(productToText({ id: "p" }).text, "")
})

test("public image url", () => {
  assert.equal(publicImageUrl("https://cdn.example.com/a.jpg"), "https://cdn.example.com/a.jpg")
  assert.equal(publicImageUrl("http://cdn.example.com/a.jpg"), null)
  assert.equal(publicImageUrl("https://localhost:9000/static/a.jpg"), null)
  assert.equal(publicImageUrl("https://192.168.1.4/a.jpg"), null)
  assert.equal(publicImageUrl("https://minio/a.jpg"), null)
  assert.equal(publicImageUrl(null), null)
  assert.equal(publicImageUrl("not a url"), null)
})

test("requests: workspace, image, draft", async () => {
  const seen: HttpRequest[] = []
  const request = async (req: HttpRequest) => {
    seen.push(req)
    if (req.url.endsWith("/workspaces")) return { status: 200, json: { workspaces: [{ id: WS, name: "Shop" }] } }
    if (req.url.endsWith("/media/from-url")) return { status: 201, json: { media_id: "m1" } }
    return { status: 201, json: { post_id: "p1", status: "draft", calendar_url: "https://app.solmarrow.com/calendar?post=p1" } }
  }
  assert.deepEqual(await keyWorkspace(request, KEY), { id: WS, name: "Shop" })
  assert.equal(seen[0].headers.Authorization, `Bearer ${KEY}`)
  assert.equal(await uploadImage(request, KEY, WS, "https://cdn.example.com/a.jpg"), "m1")
  const d = await createDraft(request, KEY, WS, "Hello", ["m1"], "k1")
  assert.deepEqual(d, { postId: "p1", calendarUrl: "https://app.solmarrow.com/calendar?post=p1" })
  const last = seen[seen.length - 1]
  assert.equal(last.url, `${API_URL}/workspaces/${WS}/posts`)
  assert.equal(last.headers["Idempotency-Key"], "k1")
  assert.deepEqual(JSON.parse(last.body!), { text: "Hello", account_ids: [], media_ids: ["m1"], draft: true })
})

test("errors", async () => {
  await assert.rejects(keyWorkspace(async () => ({ status: 200, json: {} }), undefined), /SOLMARROW_API_KEY/)
  await assert.rejects(keyWorkspace(async () => ({ status: 200, json: {} }), "nope"), /smk_/)
  await assert.rejects(keyWorkspace(async () => ({ status: 401, json: {} }), KEY), /did not accept/)
  await assert.rejects(keyWorkspace(async () => ({ status: 429, json: {} }), KEY), /too many/)
  await assert.rejects(keyWorkspace(async () => ({ status: 500, json: { error: { message: "boom" } } }), KEY), /boom/)
  await assert.rejects(createDraft(async () => ({ status: 201, json: {} }), KEY, WS, " ", [], "k"), /no title/)
  const evil = await createDraft(async () => ({ status: 201, json: { post_id: "p", calendar_url: "https://evil.example/x" } }), KEY, WS, "t", [], "k")
  assert.equal(evil.calendarUrl, "https://app.solmarrow.com/calendar")
  assert.equal(await uploadImage(async () => ({ status: 400, json: {} }), KEY, WS, "https://cdn.example.com/a.jpg"), null)
})

test("service: status hides the key, image skipped when not public, upload failure keeps draft", async () => {
  const bodies: string[] = []
  const svc = new SolMarrowModuleService({}, { apiKey: KEY, productUrl: "https://shop.example.com/products/{handle}" })
  ;(svc as unknown as { request: unknown }).request = async (req: HttpRequest) => {
    if (req.url.endsWith("/workspaces")) return { status: 200, json: { workspaces: [{ id: WS, name: "Shop" }] } }
    if (req.url.endsWith("/media/from-url")) throw new Error("network")
    bodies.push(req.body!)
    return { status: 201, json: { post_id: "p1" } }
  }
  const st = await svc.status()
  assert.equal(st.configured, true)
  assert.equal(st.workspace, "Shop")
  assert.equal(st.key_preview, "smk_…2345")
  assert.ok(!JSON.stringify(st).includes(KEY))

  const local = await svc.sendProduct({ id: "prod_1", title: "Mug", handle: "mug", thumbnail: "http://localhost:9000/static/mug.jpg" })
  assert.equal(local.image, "skipped")
  assert.equal(local.link, true)
  const failed = await svc.sendProduct({ id: "prod_1", title: "Mug", handle: "mug", thumbnail: "https://cdn.example.com/mug.jpg" })
  assert.equal(failed.image, "skipped")
  const none = await svc.sendProduct({ id: "prod_1", title: "Mug" })
  assert.equal(none.image, "none")
  assert.equal(none.link, false)
  assert.equal(JSON.parse(bodies[0]).text, "Mug\n\nhttps://shop.example.com/products/mug")

  const off = new SolMarrowModuleService({}, {})
  const st2 = await off.status()
  assert.equal(st2.configured, false)
  assert.match(st2.problems[0], /SOLMARROW_API_KEY/)
})
