# Sanity Clean Content Studio

Congratulations, you have now installed the Sanity Content Studio, an open-source real-time content editing environment connected to the Sanity backend.

Now you can do the following things:

- [Read “getting started” in the docs](https://www.sanity.io/docs/introduction/getting-started?utm_source=readme)
- [Join the Sanity community](https://www.sanity.io/community/join?utm_source=readme)
- [Extend and build plugins](https://www.sanity.io/docs/content-studio/extending?utm_source=readme)

## Migrations

### Migrate product categories from string to array

The `category` field on the `product` schema was changed from a `string` to an `array of strings`.
Existing documents that still store a plain string value will cause a type mismatch.

Run the migration script once to convert every affected document:

```bash
SANITY_API_TOKEN=<your-token> node migrate-categories.mjs
```

The script finds all `product` documents where `category` is a string, wraps the value in an array (`"Ortodoncia"` → `["Ortodoncia"]`), and patches them in a single batch request. Documents that already store an array are left untouched.

### Fix broken product image references

If a product contains image objects without `asset._ref`, Astro builds can fail with:
`Unable to resolve image URL from source`.

Run a dry check first:

```bash
SANITY_API_TOKEN=<your-token> npm run sanity:fix-images:check
```

Apply the fixes:

```bash
SANITY_API_TOKEN=<your-token> npm run sanity:fix-images:apply
```

This script only targets `product` documents and repairs these fields:
- `image` (unsets invalid object)
- `images[]` (removes invalid items)
- `variants[].image` (removes invalid image object)
