# Products Guide

## Adding a product

Products are added from the Products page ("Add Product") with a name and
a price, and an optional unit (for example "kg", "pcs", "box"). The price
is what gets used automatically whenever that product is added to a bill.

## Searching products

The Products page has a search box that matches by product name.

## Deactivating and reactivating a product

A product that's no longer sold can be deactivated ("Deactivate Product")
instead of deleted, and reactivated later ("Reactivate Product") if
needed. An inactive product is hidden from the normal product list (shown
as "Inactive") and cannot be added to a new bill, but it does not affect
any bill it already appears on.

## How a product's price is used on a bill

When a product is added to a draft bill, its current price is used for the
line total shown while editing. When the bill is finalized with "Generate
Bill", every item's price is looked up fresh at that exact moment — so if a
product's price changed between saving the draft and finalizing it, the
finalized bill always reflects the price at finalization, not an older
cached price. Changing a product's price afterwards never changes any
already-finalized bill.

## Top-selling products

The dashboard can show which products have sold the most, by quantity,
over a given period.
