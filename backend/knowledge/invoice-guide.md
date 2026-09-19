# Invoice / Bill Guide

An "invoice" and a "bill" mean the same thing in this system: the record
created when a draft is finalized with "Generate Bill".

## Bill number

Once finalized, a bill receives a permanent bill number in the form
INV-<year>-<sequence>, for example INV-2026-0001. Numbering is sequential
per shop and restarts at 0001 each calendar year, so two different shops
can have the exact same bill number without any conflict — each shop's
numbering is entirely independent.

## What's on a bill

A finalized bill shows: the shop's own business details (name, address,
phone, email, and any invoice terms the shop has set), the customer's name
and mobile number, the date it was generated, each item with its product
name, quantity, unit, price, and line total, the subtotal, the final total,
the total written out in words, and the payment method and payment status.

## Invoice terms

A shop can set its own invoice terms text (for example, a returns or
warranty policy) in its shop settings. If set, this text appears on every
PDF bill generated for that shop.

## Bill status

A bill is either:
- **draft** — still editable, not yet numbered, and
- **finalized** — permanently numbered, with locked-in prices; only its
  payment status can change afterwards (see payment-guide.md for how).

## Viewing and downloading a bill

Open a bill from the Bills page to see its full detail, and view or
download it as a PDF from there.

## Why prices don't change after finalizing

A finalized bill's item prices and total are locked in permanently, even
if a product's price changes later or the customer's details are edited
afterwards. This keeps every past bill an accurate historical record of
what was actually charged at the time.
