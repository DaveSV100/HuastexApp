defaultdb=> \d
                 List of relations
 Schema |         Name         |   Type   |  Owner  
--------+----------------------+----------+---------
 public | branch_stock         | table    | doadmin
 public | branch_stock_id_seq  | sequence | doadmin
 public | daily_accounting     | table    | doadmin
 public | formulas             | table    | doadmin
 public | formulas_id_seq      | sequence | doadmin
 public | inventory            | table    | doadmin
 public | inventory_id_seq     | sequence | doadmin
 public | payments             | table    | doadmin
 public | payments_id_seq      | sequence | doadmin
 public | products             | table    | doadmin
 public | products_id_seq      | sequence | doadmin
 public | sale_products        | table    | doadmin
 public | sale_products_id_seq | sequence | doadmin
 public | sales                | table    | doadmin
 public | sales_id_seq         | sequence | doadmin
 public | transactions         | table    | doadmin
 public | transactions_id_seq  | sequence | doadmin
 public | users                | table    | doadmin
 public | users_id_seq         | sequence | doadmin
(19 rows)

defaultdb=> \d public.*
defaultdb=> \d public.*
                                             Table "public.branch_stock"
       Column        |            Type             | Collation | Nullable |                 Default                  
---------------------+-----------------------------+-----------+----------+------------------------------------------
 id                  | integer                     |           | not null | nextval('branch_stock_id_seq'::regclass)
 inventory_id        | integer                     |           |          | 
 quantity            | integer                     |           |          | 
 price               | numeric                     |           |          | 
 branch_location     | text                        |           |          | 
 branch_arrival_date | timestamp without time zone |           |          | 
 comments            | text                        |           |          | 
Indexes:
    "branch_stock_pkey" PRIMARY KEY, btree (id)
Foreign-key constraints:
    "branch_stock_inventory_id_fkey" FOREIGN KEY (inventory_id) REFERENCES inventory(id)

                Sequence "public.branch_stock_id_seq"
  Type   | Start | Minimum |  Maximum   | Increment | Cycles? | Cache 
---------+-------+---------+------------+-----------+---------+-------
 integer |     1 |       1 | 2147483647 |         1 | no      |     1
Owned by: public.branch_stock.id

   Index "public.branch_stock_pkey"
 Column |  Type   | Key? | Definition 
--------+---------+------+------------
 id     | integer | yes  | id
primary key, btree, for table "public.branch_stock"

                                 Table "public.daily_accounting"
      Column      |          Type          | Collation | Nullable |           Default            
------------------+------------------------+-----------+----------+------------------------------
 accounting_date  | date                   |           | not null | 
 counted_amount   | numeric(15,2)          |           |          | 
 cash_in_register | numeric(15,2)          |           |          | 
 cashier_name     | character varying(255) |           |          | 
 location         | character varying(50)  |           | not null | 'default'::character varying
Indexes:
    "daily_accounting_pkey" PRIMARY KEY, btree (accounting_date, location)
    "daily_accounting_date_location_unique" UNIQUE CONSTRAINT, btree (accounting_date, location)

       Index "public.daily_accounting_date_location_unique"
     Column      |         Type          | Key? |   Definition    
-----------------+-----------------------+------+-----------------
 accounting_date | date                  | yes  | accounting_date
 location        | character varying(50) | yes  | location
unique, btree, for table "public.daily_accounting"

               Index "public.daily_accounting_pkey"
     Column      |         Type          | Key? |   Definition    
-----------------+-----------------------+------+-----------------
 accounting_date | date                  | yes  | accounting_date
 location        | character varying(50) | yes  | location
primary key, btree, for table "public.daily_accounting"

                                   Table "public.formulas"
       Column        |  Type   | Collation | Nullable |               Default                
---------------------+---------+-----------+----------+--------------------------------------
 id                  | integer |           | not null | nextval('formulas_id_seq'::regclass)
 name                | text    |           |          | 
 operators           | text    |           |          | 
 pc_example          | numeric |           |          | 
 final_price_example | numeric |           |          | 
Indexes:
    "formulas_pkey" PRIMARY KEY, btree (id)
Referenced by:
    TABLE "inventory" CONSTRAINT "fk_inventory_formula" FOREIGN KEY (formula_id) REFERENCES formulas(id)

                  Sequence "public.formulas_id_seq"
  Type   | Start | Minimum |  Maximum   | Increment | Cycles? | Cache 
---------+-------+---------+------------+-----------+---------+-------
 integer |     1 |       1 | 2147483647 |         1 | no      |     1
Owned by: public.formulas.id

     Index "public.formulas_pkey"
 Column |  Type   | Key? | Definition 
--------+---------+------+------------
 id     | integer | yes  | id
primary key, btree, for table "public.formulas"

Index "public.idx_transactions_sale_id"
 Column  |  Type   | Key? | Definition 
---------+---------+------+------------
 sale_id | integer | yes  | sale_id
btree, for table "public.transactions"

                                                Table "public.inventory"
          Column           |            Type             | Collation | Nullable |                Default                
---------------------------+-----------------------------+-----------+----------+---------------------------------------
 id                        | integer                     |           | not null | nextval('inventory_id_seq'::regclass)
 product                   | text                        |           |          | 
 price_cost                | numeric                     |           |          | 
 model                     | text                        |           |          | 
 serial_number             | text                        |           |          | 
 cerro_azul_price          | numeric                     |           |          | 
 aquismon_price            | numeric                     |           |          | 
 tepetzintla_price         | numeric                     |           |          | 
 tlacolula_price           | numeric                     |           |          | 
 headquarters_arrival_date | timestamp without time zone |           |          | 
 original_quantity         | integer                     |           |          | 
 all_branches_quantity     | integer                     |           |          | 
 internal_number           | text                        |           |          | 
 description               | text                        |           |          | 
 category                  | text                        |           |          | 
 supplier                  | text                        |           |          | 
 supplier_bill             | text                        |           |          | 
 final_customer_bill       | text                        |           |          | 
 devolution_bill           | text                        |           |          | 
 bank_deposit              | text                        |           |          | 
 comments                  | text                        |           |          | 
 cerro_azul_msiprice       | numeric                     |           |          | 
 cerro_azul_creditprice    | numeric                     |           |          | 
 aquismon_msiprice         | numeric                     |           |          | 
 aquismon_creditprice      | numeric                     |           |          | 
 tepetzintla_msiprice      | numeric                     |           |          | 
 tepetzintla_creditprice   | numeric                     |           |          | 
 tlacolula_msiprice        | numeric                     |           |          | 
 tlacolula_creditprice     | numeric                     |           |          | 
 formula_id                | integer                     |           |          | 
Indexes:
    "inventory_pkey" PRIMARY KEY, btree (id)
Foreign-key constraints:
    "fk_inventory_formula" FOREIGN KEY (formula_id) REFERENCES formulas(id)
Referenced by:
    TABLE "branch_stock" CONSTRAINT "branch_stock_inventory_id_fkey" FOREIGN KEY (inventory_id) REFERENCES inventory(id)
    TABLE "sale_products" CONSTRAINT "fk_inventory_id" FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON UPDATE CASCADE ON DELETE SET NULL

                  Sequence "public.inventory_id_seq"
  Type   | Start | Minimum |  Maximum   | Increment | Cycles? | Cache 
---------+-------+---------+------------+-----------+---------+-------
 integer |     1 |       1 | 2147483647 |         1 | no      |     1
Owned by: public.inventory.id

    Index "public.inventory_pkey"
 Column |  Type   | Key? | Definition 
--------+---------+------+------------
 id     | integer | yes  | id
primary key, btree, for table "public.inventory"

                                            Table "public.payments"
         Column         |          Type          | Collation | Nullable |               Default                
------------------------+------------------------+-----------+----------+--------------------------------------
 id                     | integer                |           | not null | nextval('payments_id_seq'::regclass)
 sale_id                | integer                |           | not null | 
 fecha                  | date                   |           | not null | 
 cantidad               | numeric(10,2)          |           | not null | 
 cajero                 | character varying(100) |           | not null | 
 saldo_precio_normal    | numeric(10,2)          |           | not null | 
 saldo_precio_promocion | numeric(10,2)          |           | not null | 
Indexes:
    "payments_pkey" PRIMARY KEY, btree (id)
Foreign-key constraints:
    "payments_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE

                  Sequence "public.payments_id_seq"
  Type   | Start | Minimum |  Maximum   | Increment | Cycles? | Cache 
---------+-------+---------+------------+-----------+---------+-------
 integer |     1 |       1 | 2147483647 |         1 | no      |     1
Owned by: public.payments.id

     Index "public.payments_pkey"
 Column |  Type   | Key? | Definition 
--------+---------+------+------------
 id     | integer | yes  | id
primary key, btree, for table "public.payments"

                                       Table "public.products"
    Column     |          Type          | Collation | Nullable |               Default                
---------------+------------------------+-----------+----------+--------------------------------------
 id            | integer                |           | not null | nextval('products_id_seq'::regclass)
 title         | character varying(255) |           |          | 
 description   | text                   |           |          | 
 price         | numeric(10,2)          |           |          | 
 image_url     | text                   |           |          | 
 category      | character varying(100) |           |          | 
 model         | character varying(100) |           |          | NULL::character varying
 serial_number | character varying(100) |           |          | NULL::character varying
Indexes:
    "products_pkey" PRIMARY KEY, btree (id)
Referenced by:
    TABLE "sale_products" CONSTRAINT "sale_products_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL

                  Sequence "public.products_id_seq"
  Type   | Start | Minimum |  Maximum   | Increment | Cycles? | Cache 
---------+-------+---------+------------+-----------+---------+-------
 integer |     1 |       1 | 2147483647 |         1 | no      |     1
Owned by: public.products.id

     Index "public.products_pkey"
 Column |  Type   | Key? | Definition 
--------+---------+------+------------
 id     | integer | yes  | id
primary key, btree, for table "public.products"

                                       Table "public.sale_products"
    Column     |          Type          | Collation | Nullable |                  Default                  
---------------+------------------------+-----------+----------+-------------------------------------------
 id            | integer                |           | not null | nextval('sale_products_id_seq'::regclass)
 sale_id       | integer                |           | not null | 
 product_id    | integer                |           |          | 
 quantity      | integer                |           | not null | 
 unit_price    | numeric(10,2)          |           | not null | 
 serial_number | character varying(255) |           |          | 
 producto      | character varying(255) |           |          | 
 inventory_id  | integer                |           |          | 
Indexes:
    "sale_products_pkey" PRIMARY KEY, btree (id)
Foreign-key constraints:
    "fk_inventory_id" FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON UPDATE CASCADE ON DELETE SET NULL
    "sale_products_product_id_fkey" FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL
    "sale_products_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE

                Sequence "public.sale_products_id_seq"
  Type   | Start | Minimum |  Maximum   | Increment | Cycles? | Cache 
---------+-------+---------+------------+-----------+---------+-------
 integer |     1 |       1 | 2147483647 |         1 | no      |     1
Owned by: public.sale_products.id

  Index "public.sale_products_pkey"
 Column |  Type   | Key? | Definition 
--------+---------+------+------------
 id     | integer | yes  | id
primary key, btree, for table "public.sale_products"

                                            Table "public.sales"
         Column         |          Type          | Collation | Nullable |              Default              
------------------------+------------------------+-----------+----------+-----------------------------------
 id                     | integer                |           | not null | nextval('sales_id_seq'::regclass)
 nombre                 | character varying(100) |           |          | 
 calleynumero           | character varying(255) |           |          | 
 ciudad                 | character varying(100) |           |          | 
 estado                 | character varying(100) |           |          | 
 fecha                  | date                   |           |          | 
 producto               | text                   |           |          | 
 formadepago            | character varying(50)  |           |          | 
 enganche               | numeric(10,2)          |           |          | NULL::numeric
 precionormal           | numeric(10,2)          |           |          | NULL::numeric
 preciopromocion        | numeric(10,2)          |           |          | NULL::numeric
 saldo_precio_normal    | numeric(10,2)          |           |          | NULL::numeric
 saldo_precio_promocion | numeric(10,2)          |           |          | NULL::numeric
 plazo                  | character varying(50)  |           |          | NULL::character varying
 fechavencimiento       | date                   |           |          | 
 sucursal               | character varying(100) |           |          | 'website'::character varying
 agentedeventas         | character varying(100) |           |          | NULL::character varying
 aclaraciones           | text                   |           |          | 
 firmadigital           | text                   |           |          | 
 quantity               | integer                |           |          | 1
 email                  | character varying(255) |           |          | ''::character varying
 phone                  | bigint                 |           |          | 
 status                 | character varying(50)  |           |          | 'por entregar'::character varying
 total_price            | numeric(10,2)          |           |          | NULL::numeric
 discount               | numeric(10,2)          |           |          | NULL::numeric
Indexes:
    "sales_pkey" PRIMARY KEY, btree (id)
Referenced by:
    TABLE "payments" CONSTRAINT "payments_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    TABLE "sale_products" CONSTRAINT "sale_products_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    TABLE "transactions" CONSTRAINT "transactions_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL

                    Sequence "public.sales_id_seq"
  Type   | Start | Minimum |  Maximum   | Increment | Cycles? | Cache 
---------+-------+---------+------------+-----------+---------+-------
 integer |     1 |       1 | 2147483647 |         1 | no      |     1
Owned by: public.sales.id

      Index "public.sales_pkey"
 Column |  Type   | Key? | Definition 
--------+---------+------+------------
 id     | integer | yes  | id
primary key, btree, for table "public.sales"

                                           Table "public.transactions"
      Column      |            Type             | Collation | Nullable |                 Default                  
------------------+-----------------------------+-----------+----------+------------------------------------------
 id               | integer                     |           | not null | nextval('transactions_id_seq'::regclass)
 transaction_type | character varying(50)       |           | not null | 
 name             | character varying(255)      |           |          | 
 product          | character varying(255)      |           |          | 
 value            | numeric(15,2)               |           |          | 
 saldo            | numeric(15,2)               |           |          | 
 por_pagar        | numeric(15,2)               |           |          | 
 transaction_date | date                        |           | not null | CURRENT_DATE
 created_at       | timestamp without time zone |           |          | CURRENT_TIMESTAMP
 updated_at       | timestamp without time zone |           |          | CURRENT_TIMESTAMP
 payment_type     | character varying(50)       |           | not null | 'deposit'::character varying
 location         | character varying(50)       |           |          | NULL::character varying
 sale_id          | integer                     |           |          | 
Indexes:
    "transactions_pkey" PRIMARY KEY, btree (id)
    "idx_transactions_sale_id" btree (sale_id)
Foreign-key constraints:
    "transactions_sale_id_fkey" FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL

                Sequence "public.transactions_id_seq"
  Type   | Start | Minimum |  Maximum   | Increment | Cycles? | Cache 
---------+-------+---------+------------+-----------+---------+-------
 integer |     1 |       1 | 2147483647 |         1 | no      |     1
Owned by: public.transactions.id

   Index "public.transactions_pkey"
 Column |  Type   | Key? | Definition 
--------+---------+------+------------
 id     | integer | yes  | id
primary key, btree, for table "public.transactions"

                                       Table "public.users"
    Column    |          Type          | Collation | Nullable |              Default              
--------------+------------------------+-----------+----------+-----------------------------------
 id           | integer                |           | not null | nextval('users_id_seq'::regclass)
 name         | character varying(100) |           | not null | 
 email        | character varying(100) |           | not null | 
 password     | character varying(255) |           | not null | 
 type_of_user | character varying(50)  |           |          | 
 branch       | character varying(50)  |           |          | 
Indexes:
    "users_pkey" PRIMARY KEY, btree (id)
    "users_email_key" UNIQUE CONSTRAINT, btree (email)

           Index "public.users_email_key"
 Column |          Type          | Key? | Definition 
--------+------------------------+------+------------
 email  | character varying(100) | yes  | email
unique, btree, for table "public.users"

                    Sequence "public.users_id_seq"
  Type   | Start | Minimum |  Maximum   | Increment | Cycles? | Cache 
---------+-------+---------+------------+-----------+---------+-------
 integer |     1 |       1 | 2147483647 |         1 | no      |     1
Owned by: public.users.id

      Index "public.users_pkey"
 Column |  Type   | Key? | Definition 
--------+---------+------+------------
 id     | integer | yes  | id
primary key, btree, for table "public.users"

defaultdb=> 
