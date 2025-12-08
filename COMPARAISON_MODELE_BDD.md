# Comparaison : Modèle de Base de Données Proposé vs Structure Actuelle

## 📊 Résumé Exécutif

La structure actuelle de la base de données **ne correspond pas exactement** au modèle proposé. Il manque plusieurs tables importantes et certaines relations ne sont pas implémentées comme décrit.

---

## ✅ Ce qui EXISTE déjà

### 1. **Clients (Customers)** ✅
- ✅ Table `customers` existe
- ✅ Champs de base : `id`, `name`, `address`, `latitude`, `longitude`
- ✅ Champs CRM ajoutés : `customer_type`, `segment`, `email`, `phone`, `vat_number`, etc.
- ❌ **MANQUE** : Pas de relation explicite avec Sites (voir ci-dessous)

### 2. **Matières (Materials)** ✅
- ✅ Table `materials` existe
- ✅ Champs : `id`, `famille`, `numero`, `abrege`, `description`, `unite`
- ❌ **MANQUE** : Pas de table `MaterialQualities` séparée (qualités stockées ailleurs)

### 3. **Contrats (Contracts)** ⚠️ PARTIEL
- ✅ Table `customer_contracts` existe
- ✅ Champs : `id`, `customer_id`, `contract_number`, `start_date`, `end_date`, `status`
- ❌ **MANQUE** : 
  - Pas de table `ContractMaterials` (liaison N-N entre contrats et matières)
  - Pas de table `PriceSchedules` (barèmes de prix par période/matière/qualité)

### 4. **Factures (Invoices)** ✅
- ✅ Table `invoices` existe
- ✅ Table `invoice_lines` existe
- ✅ Champs de base présents
- ⚠️ **PARTIEL** : Les lignes de facture référencent `material_id` mais pas de référence directe aux `Lots` ou `Collections`

### 5. **Lots/Stocks (Lots)** ✅
- ✅ Table `stock_lots` existe
- ✅ Champs : `id`, `lot_number`, `material_id`, `warehouse_id`, `quantity`, `quality_status`
- ❌ **MANQUE** : Pas de référence à `Weighing` (pesée qui a créé le lot)

### 6. **Fournisseurs (Vendors)** ✅
- ✅ Table `suppliers` existe (nommée différemment mais équivalente)
- ✅ Champs complets : `supplier_type`, `contact_name`, `vat_number`, etc.

---

## ❌ Ce qui MANQUE complètement

### 1. **Sites/Points de collecte (Sites)** ❌
- ❌ **AUCUNE table `sites`** n'existe
- ❌ Les clients n'ont pas de sites rattachés
- ⚠️ Les `route_stops` référencent directement `customer_id` mais pas de concept de "Site"

### 2. **Collectes / Bons d'entrée (Collections)** ❌
- ❌ **AUCUNE table `collections`** n'existe
- ❌ Pas de concept de "passage de camion sur un site"
- ⚠️ Les `routes` et `route_stops` existent mais ne représentent pas les collectes avec pesées

### 3. **Pesées (Weighings)** ❌
- ❌ **AUCUNE table `weighings`** n'existe
- ❌ Pas de stockage des pesées (tare, brut, net, horodatage, balance)
- ❌ Pas de lien entre pesées et lots

### 4. **Déclassements (Downgrades)** ❌
- ❌ **AUCUNE table `downgrades`** n'existe
- ❌ Pas de traçabilité des changements de qualité
- ⚠️ Le champ `quality_status` dans `stock_lots` existe mais pas d'historique

### 5. **Barèmes de prix (PriceSchedules)** ❌
- ❌ **AUCUNE table `price_schedules`** n'existe
- ⚠️ Table `customer_pricing` existe mais structure différente :
  - Pas de liaison avec contrats
  - Pas de gestion par qualité
  - Pas de plages de poids (min_weight, max_weight)

### 6. **ContractMaterials (Table de jointure)** ❌
- ❌ **AUCUNE table `contract_materials`** n'existe
- ❌ Impossible de lier plusieurs matières à un contrat

---

## 🔄 Relations Manquantes ou Différentes

### Relations Proposées vs Actuelles

| Relation Proposée | État Actuel | Commentaire |
|-------------------|-------------|-------------|
| `Client 1—N Sites` | ❌ N'existe pas | Pas de table `sites` |
| `Client 1—N Contracts` | ✅ Existe | Via `customer_contracts` |
| `Contract 1—N PriceSchedules` | ❌ N'existe pas | Pas de table `price_schedules` |
| `Contract N—N Materials` | ❌ N'existe pas | Pas de table `contract_materials` |
| `Collection → Site → Contract` | ❌ N'existe pas | Pas de tables `collections` ni `sites` |
| `Collection 1—N Weighings` | ❌ N'existe pas | Pas de tables `collections` ni `weighings` |
| `Weighing → Lot` | ❌ N'existe pas | Pas de table `weighings`, `stock_lots` n'a pas de référence |
| `Lot 0—N Downgrades` | ❌ N'existe pas | Pas de table `downgrades` |
| `InvoiceLine → Lot` | ⚠️ Partiel | `invoice_lines` référence `material_id` mais pas `lot_id` |
| `InvoiceLine → Collection` | ❌ N'existe pas | Pas de table `collections` |

---

## 📋 Structure Actuelle vs Proposée - Détails

### 1. **Clients et Sites**

**Proposé :**
```
Clients (1) ──< (N) Sites
```

**Actuel :**
```
Clients (1) ──< (N) route_stops (mais pas de concept Site)
```

**Impact :** Impossible de gérer plusieurs points de collecte par client.

---

### 2. **Contrats et Matières**

**Proposé :**
```
Contracts (1) ──< (N) PriceSchedules
Contracts (N) ──< (N) Materials (via ContractMaterials)
```

**Actuel :**
```
customer_contracts (1) ──< (N) customer_pricing (mais pas de liaison explicite)
```

**Impact :** 
- Pas de barèmes de prix liés aux contrats
- Pas de gestion multi-matériaux par contrat
- Pas de plages de poids/qualité dans les prix

---

### 3. **Collectes et Pesées**

**Proposé :**
```
Collections (1) ──< (N) Weighings
Weighings (1) ──< (1) Lots
```

**Actuel :**
```
routes (1) ──< (N) route_stops
stock_lots (isolé, pas de référence à pesée)
```

**Impact :**
- Pas de traçabilité complète : Collection → Pesée → Lot
- Pas de stockage des pesées (tare, brut, net)
- Pas de référence à la balance utilisée

---

### 4. **Déclassements**

**Proposé :**
```
Lots (1) ──< (N) Downgrades
```

**Actuel :**
```
stock_lots.quality_status (champ simple, pas d'historique)
```

**Impact :**
- Pas d'historique des changements de qualité
- Pas de justification des déclassements
- Pas d'ajustement de valeur/poids tracé

---

### 5. **Facturation**

**Proposé :**
```
Invoices (1) ──< (N) InvoiceLines
InvoiceLines → Lots (ou Collections)
```

**Actuel :**
```
invoices (1) ──< (N) invoice_lines
invoice_lines → material_id (mais pas lot_id ni collection_id)
```

**Impact :**
- Impossible de facturer directement à partir des lots
- Pas de lien entre facture et collecte/pesée

---

## 🎯 Recommandations

### Priorité HAUTE

1. **Créer la table `sites`**
   - Lier aux clients
   - Permettre plusieurs sites par client

2. **Créer la table `collections`**
   - Lier aux sites
   - Référencer les contrats applicables
   - Stocker les informations de collecte (date, chauffeur, véhicule)

3. **Créer la table `weighings`**
   - Lier aux collections
   - Stocker tare, brut, net, horodatage, balance
   - Créer automatiquement les lots depuis les pesées

4. **Modifier `stock_lots`**
   - Ajouter `weighing_id` pour tracer l'origine

### Priorité MOYENNE

5. **Créer la table `price_schedules`**
   - Lier aux contrats et matières
   - Gérer les plages de poids/qualité/dates

6. **Créer la table `contract_materials`**
   - Permettre plusieurs matières par contrat

7. **Créer la table `downgrades`**
   - Historiser les changements de qualité
   - Traçabilité complète

### Priorité BASSE

8. **Modifier `invoice_lines`**
   - Ajouter `lot_id` et `collection_id` (optionnels)
   - Permettre facturation directe depuis lots/collectes

---

## 📝 Tables à Créer

### 1. Sites
```sql
create table sites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references customers(id) on delete cascade,
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
```

### 2. Collections
```sql
create table collections (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id) on delete cascade,
  contract_id uuid references customer_contracts(id) on delete set null,
  reference text not null,
  collected_at timestamptz not null,
  driver text,
  vehicle_id uuid references vehicles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
```

### 3. Weighings
```sql
create table weighings (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references collections(id) on delete cascade,
  scale_id text,
  weigh_type text not null check (weigh_type in ('gross', 'tare', 'net')),
  weight_gross numeric,
  weight_tare numeric,
  weight_net numeric not null,
  ticket_no text,
  weighed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
```

### 4. PriceSchedules
```sql
create table price_schedules (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references customer_contracts(id) on delete cascade,
  material_id uuid references materials(id) on delete cascade,
  quality_id uuid, -- À créer si nécessaire
  valid_from date not null,
  valid_to date,
  min_weight numeric,
  max_weight numeric,
  price_per_ton numeric not null,
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);
```

### 5. ContractMaterials
```sql
create table contract_materials (
  contract_id uuid references customer_contracts(id) on delete cascade,
  material_id uuid references materials(id) on delete cascade,
  quality_id uuid, -- Optionnel
  notes text,
  primary key (contract_id, material_id)
);
```

### 6. Downgrades
```sql
create table downgrades (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid references stock_lots(id) on delete cascade,
  from_quality_id uuid,
  to_quality_id uuid,
  reason text not null,
  adjusted_weight numeric,
  adjusted_value numeric,
  performed_at timestamptz not null default now(),
  performed_by uuid references users(id) on delete set null
);
```

---

## 🔧 Modifications à Apporter

### 1. Modifier `stock_lots`
```sql
alter table stock_lots add column if not exists weighing_id uuid references weighings(id) on delete set null;
```

### 2. Modifier `invoice_lines`
```sql
alter table invoice_lines add column if not exists lot_id uuid references stock_lots(id) on delete set null;
alter table invoice_lines add column if not exists collection_id uuid references collections(id) on delete set null;
```

---

## ✅ Conclusion

La structure actuelle est **partiellement alignée** avec le modèle proposé mais il manque des éléments critiques pour une traçabilité complète :

- ❌ **Sites** : Absents
- ❌ **Collections** : Absentes  
- ❌ **Weighings** : Absentes
- ❌ **Downgrades** : Absents
- ❌ **PriceSchedules** : Absents
- ❌ **ContractMaterials** : Absent

**Recommandation :** Implémenter les tables manquantes en priorité pour établir la chaîne de traçabilité complète : **Client → Site → Collection → Weighing → Lot → Invoice**.

