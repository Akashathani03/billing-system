# Billing System Help

This is a general-purpose billing system for a shop or small business. Each
shop's customers, products, and bills are completely separate from every
other shop using the system.

## Creating a bill

Open "New Bill", pick an existing customer (or add a new one first), then
tap "+ Add Product" to add one or more products with a quantity. As you add
items, the subtotal and total update automatically using each product's
current price. When you're ready, either:

- "Save Draft" — keeps the bill as an editable draft, or
- "Generate Bill" — finalizes it into a permanent, numbered bill.

## Draft bills

A draft is a bill that hasn't been finalized yet. Drafts can still be
edited (customer, items, payment method, payment status) or deleted from
the "Drafts" list. A draft has no bill/invoice number yet.

## Finalized bills ("Generate Bill")

Tapping "Generate Bill" turns a draft into a permanent bill: it is given a
sequential bill number, its prices are locked in using each product's price
at that exact moment, and it can no longer be edited or deleted. The only
thing that can still change afterwards is marking its payment as paid (see
payment-guide.md).

## Viewing bills

The "Bills" page lists finalized bills, split into "Paid" and "Pending"
tabs, with a search box that matches bill number, customer name, or mobile
number. Draft bills have their own separate "Drafts" list. Tapping a bill
opens its full detail, including the option to view or download it as a
PDF.

## Adding a customer

Customers are added from the Customers page ("Add Customer") with a name
and mobile number, and an optional address. Existing customers can be
searched by name or mobile number. Opening a customer shows their total
number of bills, total amount purchased, and their full bill history.

## Manual bill photos

For a paper bill written outside this system, a photo of it can be
attached to a customer from that customer's page ("+ Add Bill Photo").
This is just a stored photo for record-keeping — it does not create a
digital bill or affect any totals.

## The dashboard

The home screen shows today's sales, how much is paid vs. pending, a
breakdown by payment method, the most recent bills, and a 7-day sales
trend.
