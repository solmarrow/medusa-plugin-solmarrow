# SolMarrow for Medusa

Send a Medusa product to [SolMarrow](https://solmarrow.com) as a social media **draft**, straight from the product
page in Medusa Admin. Open SolMarrow afterwards to pick accounts, edit and schedule it. The plugin never publishes
anything.

Works with Medusa v2 (2.7 and newer).

## Install

```bash
npm install medusa-plugin-solmarrow
```

## Set up

1. In SolMarrow open **Settings → API keys** and create a key for the workspace your drafts should go to. It starts with `smk_`.
2. Add the key to your Medusa `.env`:

   ```bash
   SOLMARROW_API_KEY=smk_...
   ```

3. Register the plugin in `medusa-config.ts`:

   ```ts
   module.exports = defineConfig({
     // ...
     plugins: [
       {
         resolve: "medusa-plugin-solmarrow",
         options: {
           apiKey: process.env.SOLMARROW_API_KEY,
           // Optional: adds the product page link to each draft. Placeholders: {handle}, {id}.
           productUrl: "https://shop.example.com/products/{handle}",
           // Optional: set to false to send drafts without the product image.
           sendImage: true,
         },
       },
     ],
   })
   ```

4. Restart Medusa. **Settings → SolMarrow** (under Extensions) shows whether the key works and which workspace it belongs to.

## Use it

Open a product in Medusa Admin and press **Send to SolMarrow** in the SolMarrow card on the right. The draft gets:

- the product title,
- the subtitle, or the start of the description (about 280 characters),
- the product link, if `productUrl` is set,
- the product thumbnail, if it has a public `https://` address (images on `localhost` or a private network are skipped).

Then press **Open the draft in SolMarrow** to choose accounts and schedule it.

## Network use and privacy

- The plugin talks to one service only: `https://app.solmarrow.com`, the SolMarrow API.
- It makes requests only when an admin opens **Settings → SolMarrow** (to check the key) or presses **Send to SolMarrow**. The requests carry the post text, the image address and the API key.
- No telemetry, no tracking, no other servers.
- The API key stays on the server (plugin options) and is never sent to the browser; the settings page shows only its last 4 characters.
- Both routes (`/admin/solmarrow` and `/admin/solmarrow/products/:id`) are admin routes, so only signed-in admin users can use them.

## Develop

```bash
npm install
npm test          # unit tests (text building, requests, errors)
npm run typecheck
npm run build
```

## Support

support@solmarrow.com · [solmarrow.com](https://solmarrow.com)

MIT License
