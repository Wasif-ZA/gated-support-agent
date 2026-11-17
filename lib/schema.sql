drop table if exists refunds, runs, tickets, transactions, customers;

create table customers (
  id text primary key,
  name text not null,
  email text not null,
  plan text not null,
  since date not null
);

create table transactions (
  id text primary key,
  customer_id text not null references customers,
  description text not null,
  amount_cents int not null check (amount_cents > 0),
  created_at date not null,
  refunded_before_cents int not null default 0
);

create table tickets (
  id text primary key,
  customer_id text not null references customers,
  subject text not null,
  body text not null,
  expected text not null check (expected in ('resolved', 'escalated', 'refused')),
  expected_rule text,
  note text not null
);

create table runs (
  ticket_id text primary key references tickets,
  outcome text not null check (outcome in ('resolved', 'escalated', 'refused')),
  steps jsonb not null,
  reply text not null,
  model text not null,
  ran_at timestamptz not null default now()
);

-- Backstop: even if gate() has a bug, the database refuses a single refund over A$100.
create table refunds (
  id bigserial primary key,
  ticket_id text not null references tickets,
  transaction_id text not null references transactions,
  amount_cents int not null check (amount_cents > 0 and amount_cents <= 10000)
);
