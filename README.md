# Sanity Clean Content Studio

Congratulations, you have now installed the Sanity Content Studio, an open-source real-time content editing environment connected to the Sanity backend.

Now you can do the following things:

- [Read “getting started” in the docs](https://www.sanity.io/docs/introduction/getting-started?utm_source=readme)
- [Join the Sanity community](https://www.sanity.io/community/join?utm_source=readme)
- [Extend and build plugins](https://www.sanity.io/docs/content-studio/extending?utm_source=readme)

## Migrations

## Category management in Studio

Products now support category references through the `Categories` field.

How to add a new category from the Sanity administration:

1. Open a product document.
2. In `Categories`, click add item.
3. Use the create option in the selector to create a new `Category` document.
4. Publish the category and keep it selected on the product.

You can also create categories first from the `Category` document section in Studio, then assign them to products.

The old `category` string field remains as a fallback for compatibility while existing content is being migrated.

### Migrate legacy category values to category references

Use this migration to populate `product.categories` (references) from old `product.category` values.

Dry run (recommended first):

```bash
SANITY_API_TOKEN=<your-token> npm run sanity:migrate-category-refs:check
```

Apply migration:

```bash
SANITY_API_TOKEN=<your-token> npm run sanity:migrate-category-refs:apply
```

Apply migration and remove legacy field in same pass:

```bash
SANITY_API_TOKEN=<your-token> npm run sanity:migrate-category-refs:apply-clean
```

What it does:
- Reads legacy category values from `product.category` (string or string[]).
- Creates missing `category` documents when needed.
- Writes references into `product.categories` without duplicating existing refs.
- Optionally unsets `product.category` when using `--unset-legacy`.

### Fix missing _key in product category references

If Sanity shows "Missing keys" in the Categories field, run:

```bash
SANITY_API_TOKEN=<your-token> npm run sanity:fix-category-keys:check
```

Apply the fix:

```bash
SANITY_API_TOKEN=<your-token> npm run sanity:fix-category-keys:apply
```

This script adds `_key` values to `product.categories[]` items that are missing keys.

### Sync category documents from active products

If some categories used by products are missing or inactive in `category` documents, run:

```bash
SANITY_API_TOKEN=<your-token> npm run sanity:sync-category-docs:check
```

Apply the sync:

```bash
SANITY_API_TOKEN=<your-token> npm run sanity:sync-category-docs:apply
```

This script scans active products, collects category names, creates missing `category` documents, and re-activates matching inactive ones.

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
