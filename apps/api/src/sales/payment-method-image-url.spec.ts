/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * CP-09 — PaymentMethodService imageUrl field
 *
 * Verifies:
 *   - create() persists and returns imageUrl when provided
 *   - update() persists and returns imageUrl when patched
 *   - create() without imageUrl returns null (backward compat)
 *   - update() without imageUrl does not wipe existing value
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import {
  PaymentMethodService,
  createPaymentMethodSchema,
} from './services/payment-method.service';
import { PaymentMethod } from './entities/payment-method.entity';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeEntity = (overrides: Partial<PaymentMethod> = {}): PaymentMethod => {
  const pm = new PaymentMethod();
  pm.id = 1;
  pm.name = 'Yape';
  (pm as any).commissionPercentage = '0';
  pm.requiresTransferTime = false;
  pm.isActive = true;
  pm.imageUrl = null;
  return Object.assign(pm, overrides);
};

// ---------------------------------------------------------------------------
// Schema validation — createPaymentMethodSchema
// ---------------------------------------------------------------------------

describe('createPaymentMethodSchema — imageUrl field', () => {
  it('accepts a valid URL string', () => {
    const result = createPaymentMethodSchema.safeParse({
      name: 'Yape',
      imageUrl: 'https://example.com/qr.png',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.imageUrl).toBe('https://example.com/qr.png');
  });

  it('accepts a base64 data URI', () => {
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ';
    const result = createPaymentMethodSchema.safeParse({ name: 'Yape', imageUrl: dataUri });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.imageUrl).toBe(dataUri);
  });

  it('accepts null (no image)', () => {
    const result = createPaymentMethodSchema.safeParse({ name: 'Yape', imageUrl: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.imageUrl).toBeNull();
  });

  it('accepts undefined (field absent — backward compat)', () => {
    const result = createPaymentMethodSchema.safeParse({ name: 'Efectivo' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.imageUrl).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Service — create() and update()
// ---------------------------------------------------------------------------

describe('PaymentMethodService — imageUrl persistence', () => {
  let service: PaymentMethodService;
  let mockRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    mockRepo = {
      findOne: jest.fn(),
      create: jest.fn((dto: any) => Object.assign(new PaymentMethod(), dto)),
      save: jest.fn(async (entity: PaymentMethod) => entity),
      find: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentMethodService,
        { provide: getRepositoryToken(PaymentMethod), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<PaymentMethodService>(PaymentMethodService);
  });

  it('create() persists and returns imageUrl when provided', async () => {
    mockRepo.findOne.mockResolvedValue(null); // no duplicate name
    const imageUrl = 'https://example.com/yape-qr.png';
    const result = await service.create({
      name: 'Yape',
      commissionPercentage: 0,
      requiresTransferTime: false,
      isActive: true,
      imageUrl,
    });
    expect(result.imageUrl).toBe(imageUrl);
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('create() without imageUrl returns undefined/null (backward compat)', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    const result = await service.create({
      name: 'Efectivo',
      commissionPercentage: 0,
      requiresTransferTime: false,
      isActive: true,
    });
    // imageUrl was not provided; entity should not have a URL set
    expect(result.imageUrl == null).toBe(true);
  });

  it('create() throws ConflictException if name already exists', async () => {
    mockRepo.findOne.mockResolvedValue(makeEntity({ name: 'Yape' }));
    await expect(
      service.create({ name: 'Yape', commissionPercentage: 0, requiresTransferTime: false, isActive: true }),
    ).rejects.toThrow(ConflictException);
  });

  it('update() persists imageUrl when patched', async () => {
    const existing = makeEntity({ name: 'Yape', imageUrl: null });
    mockRepo.findOne.mockResolvedValue(existing);
    mockRepo.save.mockImplementation(async (entity: PaymentMethod) => entity);

    const newUrl = 'https://cdn.example.com/qr.png';
    const result = await service.update(1, { imageUrl: newUrl });
    expect(result.imageUrl).toBe(newUrl);
  });

  it('update() without imageUrl does not wipe existing image', async () => {
    const existingUrl = 'https://existing.example.com/qr.png';
    const existing = makeEntity({ name: 'Yape', imageUrl: existingUrl });
    mockRepo.findOne.mockResolvedValue(existing);
    mockRepo.save.mockImplementation(async (entity: PaymentMethod) => entity);

    // Patch only the name — imageUrl must remain unchanged
    const result = await service.update(1, { name: 'Yape QR' });
    expect(result.imageUrl).toBe(existingUrl);
  });

  it('update() sets imageUrl to null when explicitly cleared', async () => {
    const existing = makeEntity({ name: 'Yape', imageUrl: 'https://old.example.com/qr.png' });
    mockRepo.findOne.mockResolvedValue(existing);
    mockRepo.save.mockImplementation(async (entity: PaymentMethod) => entity);

    const result = await service.update(1, { imageUrl: null });
    expect(result.imageUrl).toBeNull();
  });
});
