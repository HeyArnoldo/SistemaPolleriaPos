import '../../config/load-env';
import * as bcrypt from 'bcryptjs';
import dataSource from '../../config/typeorm.config';
import { User } from '../../users/user.entity';
import { Profile } from '../../users/profile.entity';
import { Role } from '../../common/enums/role.enum';
import { PaymentMethod } from '../../sales/entities/payment-method.entity';
import { ProductCategory } from '../../inventory/entities/product-category.entity';
import { Product } from '../../inventory/entities/product.entity';

async function run(): Promise<void> {
  await dataSource.initialize();

  const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);

  // ── Payment methods ──────────────────────────────────────────────────────
  const pmRepo = dataSource.getRepository(PaymentMethod);

  const paymentMethods = [
    { name: 'Efectivo', commissionPercentage: 0, requiresTransferTime: false },
    { name: 'Yape', commissionPercentage: 0, requiresTransferTime: true },
  ];

  for (const pm of paymentMethods) {
    const existing = await pmRepo.findOne({ where: { name: pm.name } });
    if (!existing) {
      await pmRepo.save(pmRepo.create(pm));
      console.log(`[seed] payment method created: ${pm.name}`);
    } else {
      console.log(`[seed] payment method already exists: ${pm.name}`);
    }
  }

  // ── Product categories ───────────────────────────────────────────────────
  const categoryRepo = dataSource.getRepository(ProductCategory);

  const categoryNames = ['Pollos', 'Bebidas', 'A la carta', 'Extras', 'Otros'];
  const categoryMap: Record<string, ProductCategory> = {};

  for (const name of categoryNames) {
    let cat = await categoryRepo.findOne({ where: { name } });
    if (!cat) {
      cat = await categoryRepo.save(categoryRepo.create({ name }));
      console.log(`[seed] category created: ${name}`);
    } else {
      console.log(`[seed] category already exists: ${name}`);
    }
    categoryMap[name] = cat;
  }

  // ── Products ─────────────────────────────────────────────────────────────
  const productRepo = dataSource.getRepository(Product);

  const products: { name: string; price: number; category: string }[] = [
    // Pollos
    { name: 'Pollo Entero', price: 38.0, category: 'Pollos' },
    { name: '1/2 Pollo', price: 19.0, category: 'Pollos' },
    { name: '1/4 Pollo', price: 10.0, category: 'Pollos' },
    { name: '1/8 Pollo', price: 6.0, category: 'Pollos' },
    { name: 'Presa Especial', price: 8.0, category: 'Pollos' },
    // Bebidas
    { name: 'Inka Cola 1L', price: 5.0, category: 'Bebidas' },
    { name: 'Inka Cola 500ml', price: 3.0, category: 'Bebidas' },
    { name: 'Coca Cola 1L', price: 5.0, category: 'Bebidas' },
    { name: 'Coca Cola 500ml', price: 3.0, category: 'Bebidas' },
    { name: 'Agua 500ml', price: 2.0, category: 'Bebidas' },
    { name: 'Chicha Morada', price: 3.0, category: 'Bebidas' },
    // A la carta
    { name: 'Arroz con Leche', price: 4.0, category: 'A la carta' },
    { name: 'Ensalada', price: 3.0, category: 'A la carta' },
    // Extras
    { name: 'Papas Fritas', price: 5.0, category: 'Extras' },
    { name: 'Cremas', price: 1.0, category: 'Extras' },
    { name: 'Pan', price: 0.5, category: 'Extras' },
    // Otros
    { name: 'Delivery', price: 3.0, category: 'Otros' },
  ];

  for (const p of products) {
    const existing = await productRepo.findOne({ where: { name: p.name } });
    if (!existing) {
      const category = categoryMap[p.category];
      if (!category) continue;
      await productRepo.save(productRepo.create({ name: p.name, price: p.price, category }));
      console.log(`[seed] product created: ${p.name}`);
    } else {
      console.log(`[seed] product already exists: ${p.name}`);
    }
  }

  // ── Admin user ───────────────────────────────────────────────────────────
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  const userRepo = dataSource.getRepository(User);
  const profileRepo = dataSource.getRepository(Profile);

  if (adminUsername && adminPassword) {
    const existing = await userRepo.findOne({ where: { username: adminUsername } });
    if (!existing) {
      const profile = await profileRepo.save(
        profileRepo.create({ firstName: 'Admin', lastName: 'POS' }),
      );
      const user = userRepo.create({
        username: adminUsername,
        passwordHash: await bcrypt.hash(adminPassword, rounds),
        role: Role.Admin,
        isActive: true,
        profile,
      });
      // Bypass @BeforeInsert to avoid double-hashing
      await userRepo
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          username: user.username,
          passwordHash: user.passwordHash,
          role: user.role,
          isActive: user.isActive,
          profile,
        })
        .execute();
      console.log(`[seed] admin user created: ${adminUsername}`);
    } else {
      if (existing.role !== Role.Admin) {
        existing.role = Role.Admin;
        await userRepo.save(existing);
        console.log(`[seed] admin role ensured for: ${adminUsername}`);
      } else {
        console.log(`[seed] admin already exists: ${adminUsername}`);
      }
    }
  } else {
    console.log('[seed] ADMIN_USERNAME or ADMIN_PASSWORD not set — skipping admin user.');
  }

  // ── Default cashier user ──────────────────────────────────────────────────
  const cashierUsername = 'cajero';
  const existingCashier = await userRepo.findOne({ where: { username: cashierUsername } });
  if (!existingCashier) {
    const profile = await profileRepo.save(
      profileRepo.create({ firstName: 'Cajero', lastName: 'Principal' }),
    );
    const passwordHash = await bcrypt.hash('cajero123', rounds);
    await userRepo
      .createQueryBuilder()
      .insert()
      .into(User)
      .values({
        username: cashierUsername,
        passwordHash,
        role: Role.Cashier,
        isActive: true,
        profile,
      })
      .execute();
    console.log(`[seed] cashier user created: ${cashierUsername}`);
  } else {
    console.log(`[seed] cashier already exists: ${cashierUsername}`);
  }

  await dataSource.destroy();
  console.log('[seed] done.');
}

run().catch((err) => {
  console.error('[seed] error:', err);
  process.exit(1);
});
