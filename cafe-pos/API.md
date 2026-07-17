# 67 Café POS — External API

Connect your website or any app to the POS. All endpoints require an API key
(generate one in **Settings → API Keys**) sent as a header:

```
x-api-key: pk_xxxxxxxxxxxxxxxx
```

Base URL: `https://your-pos-domain.com` (or `http://localhost:3000` in dev).

---

## GET /api/external/menu

Returns the live menu (available items only).

```json
{
  "items": [
    { "id": "uuid", "name": "Latte", "category": "Drinks", "subcategory": "Hot Coffee",
      "size": "Tall", "variant": null, "price": 550, "allowUpsize": true, "upsizePrice": 100 }
  ]
}
```

## POST /api/external/orders

Creates an order. **Prices, tax, and totals are computed server-side** — anything
the client sends for totals is ignored. If `menu_item_id` is provided, the
authoritative menu price is used (including upsize price when
`selected_options.upsize` is true).

Request:
```json
{
  "payment_method": "cash",            // or credit_card / transfer / jazzcash / foodpanda / pending
  "order_type": "delivery",            // dine_in | takeaway | delivery | online
  "customer": { "name": "Ali", "phone": "0300..." },
  "discount_percentage": 0,
  "items": [
    {
      "menu_item_id": "uuid-from-menu",  // recommended
      "quantity": 2,
      "notes": "extra hot",
      "selected_options": { "upsize": true, "option": "Oat milk" }
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "order_id": "uuid",
  "order_number": "ORD-20260716-004",
  "status": "placed",
  "totals": { "subtotal": 1300, "discount": 0, "tax": 208, "tax_rate": 16, "total": 1508 }
}
```

Notes:
- The order appears instantly on the Kitchen/Bar screens and in Order History.
- Inventory is deducted automatically from recipes.
- Use `payment_method: "pending"` for pay-on-delivery; staff picks the real
  method when completing the order, and tax is recalculated for that method.

## GET /api/external/orders/{id}

Order status by order id **or** order number (e.g. `ORD-20260716-004`).

```json
{
  "order": {
    "id": "uuid", "orderNumber": "ORD-20260716-004", "status": "getting_ready",
    "finalTotal": 1508, "tax": 208, "taxRate": 16,
    "items": [ { "name": "Latte", "quantity": 2, "station": "bar", "stationStatus": "ready" } ]
  }
}
```

Statuses: `placed → getting_ready → completed` (or `cancelled`).

---

## Errors

| Code | Meaning |
|------|---------|
| 401  | Missing/invalid API key |
| 400  | Validation error (message in `error` field) |
| 404  | Order not found |
| 500  | Server error |
