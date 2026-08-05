import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTestSuiteInput {
  productId: string;
  name: string;
}

/**
 * TestSuite ("Module") registry (DG-04-lite). A TestSuite groups TestCases
 * for a Product — see the model docblock in prisma/schema.prisma for why
 * this is NOT the same thing as ProductComponent.
 */
@Injectable()
export class TestSuitesService {
  constructor(private readonly prisma: PrismaService) {}

  listForProduct(productId: string) {
    return this.prisma.withBypass(() =>
      this.prisma.db.testSuite.findMany({
        where: { productId },
        orderBy: { name: 'asc' },
        include: { _count: { select: { cases: true } } },
      }),
    );
  }

  async create(input: CreateTestSuiteInput) {
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    const product = await this.prisma.withBypass(() =>
      this.prisma.db.product.findUnique({ where: { id: input.productId } }),
    );
    if (!product) throw new NotFoundException(`Unknown product: ${input.productId}`);
    const existing = await this.prisma.withBypass(() =>
      this.prisma.db.testSuite.findUnique({ where: { productId_name: { productId: input.productId, name: input.name } } }),
    );
    if (existing) throw new BadRequestException(`Test suite already exists for this product: ${input.name}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.testSuite.create({ data: { productId: input.productId, name: input.name } }),
    );
  }
}
