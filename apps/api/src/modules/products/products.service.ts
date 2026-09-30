import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { TenantScope, requireTeachingScope } from "../iam/tenant-auth.types";
import { R2Service } from "../storage/r2.service";
import { R2_CATEGORY } from "../storage/r2.constants";
import { ProductsQueryDto } from "./dto/products-query.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { UpdateProductImageDto } from "./dto/update-product-image.dto";
import { SellProductDto } from "./dto/sell-product.dto";

/** 512px JPEG shu hajmdan oshmasligi kerak. */
const MAX_PRODUCT_IMAGE_BYTES = 600 * 1024;

type ImagePosition = 1 | 2 | 3;

/** `imageN`/`imageNMimeType`/`hasImageN` ustunlariga murojaat qilish uchun. */
function parsePosition(position: string): ImagePosition {
  if (position === "1" || position === "2" || position === "3") {
    return Number(position) as ImagePosition;
  }
  throw new BadRequestException("Rasm o'rni 1, 2 yoki 3 bo'lishi kerak");
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

  async findAll(scope: TenantScope, query: ProductsQueryDto) {
    const branchId = scope.branchId ?? query.branchId;
    if (scope.branchId && query.branchId && query.branchId !== scope.branchId) {
      throw new ForbiddenException("Bu filialga kirish huquqingiz yo'q");
    }
    if (!branchId) {
      throw new BadRequestException("Filialni tanlang");
    }
    return this.prisma.product.findMany({
      where: { organizationId: scope.organizationId, branchId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(scope: TenantScope, dto: CreateProductDto) {
    const branchId = requireTeachingScope(scope);
    return this.prisma.product.create({
      data: {
        organizationId: scope.organizationId,
        branchId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        color: dto.color?.trim() || null,
        priceCoins: dto.priceCoins,
        quantity: dto.quantity ?? 0,
      },
    });
  }

  async update(scope: TenantScope, id: string, dto: UpdateProductDto) {
    const product = await this.requireWritableProduct(scope, id);
    return this.prisma.product.update({
      where: { id: product.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.color !== undefined ? { color: dto.color?.trim() || null } : {}),
        ...(dto.priceCoins !== undefined ? { priceCoins: dto.priceCoins } : {}),
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
      },
    });
  }

  async remove(scope: TenantScope, id: string) {
    const product = await this.requireWritableProduct(scope, id);
    await this.prisma.product.delete({ where: { id: product.id } });
    return { id: product.id };
  }

  /**
   * Mahsulot rasmini saqlaydi. Brauzerda kvadrat qilib kesilib keladi —
   * server faqat hajmini tekshiradi (xodim avatariga o'xshab).
   */
  async updateImage(scope: TenantScope, id: string, position: string, dto: UpdateProductImageDto) {
    const pos = parsePosition(position);
    const product = await this.requireWritableProduct(scope, id);

    const [header, base64] = dto.image.split(",", 2);
    const mimeType = header.slice("data:".length, header.indexOf(";"));
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength === 0) {
      throw new BadRequestException("Rasm bo'sh");
    }
    if (buffer.byteLength > MAX_PRODUCT_IMAGE_BYTES) {
      throw new BadRequestException("Rasm hajmi juda katta");
    }

    let image: Buffer<ArrayBuffer> | null = buffer;
    let imageKey: string | null = null;
    const previousKey = pos === 1 ? product.image1Key : pos === 2 ? product.image2Key : product.image3Key;
    if (this.r2.enabled) {
      imageKey = this.r2.buildKey(scope.organizationId, R2_CATEGORY.PRODUCT_IMAGE);
      await this.r2.uploadBuffer(imageKey, buffer, mimeType);
      image = null;
    }

    const updated = await (pos === 1
      ? this.prisma.product.update({
          where: { id: product.id },
          data: { image1: image, image1Key: imageKey, image1MimeType: mimeType, hasImage1: true, imagesUpdatedAt: new Date() },
          select: { imagesUpdatedAt: true },
        })
      : pos === 2
        ? this.prisma.product.update({
            where: { id: product.id },
            data: { image2: image, image2Key: imageKey, image2MimeType: mimeType, hasImage2: true, imagesUpdatedAt: new Date() },
            select: { imagesUpdatedAt: true },
          })
        : this.prisma.product.update({
            where: { id: product.id },
            data: { image3: image, image3Key: imageKey, image3MimeType: mimeType, hasImage3: true, imagesUpdatedAt: new Date() },
            select: { imagesUpdatedAt: true },
          }));
    // DB yozuvi muvaffaqiyatli bo'lgandan KEYIN o'chiriladi — aks holda DB
    // yozuvi muvaffaqiyatsiz bo'lsa, eski qator allaqachon o'chirilgan keyga
    // ishora qilib qolib ketardi.
    if (previousKey && this.r2.enabled) {
      await this.r2.deleteObject(previousKey);
    }
    return { imagesUpdatedAt: updated.imagesUpdatedAt };
  }

  async removeImage(scope: TenantScope, id: string, position: string) {
    const pos = parsePosition(position);
    const product = await this.requireWritableProduct(scope, id);
    const previousKey = pos === 1 ? product.image1Key : pos === 2 ? product.image2Key : product.image3Key;

    const updated = await (pos === 1
      ? this.prisma.product.update({
          where: { id: product.id },
          data: { image1: null, image1Key: null, image1MimeType: null, hasImage1: false, imagesUpdatedAt: new Date() },
          select: { imagesUpdatedAt: true },
        })
      : pos === 2
        ? this.prisma.product.update({
            where: { id: product.id },
            data: { image2: null, image2Key: null, image2MimeType: null, hasImage2: false, imagesUpdatedAt: new Date() },
            select: { imagesUpdatedAt: true },
          })
        : this.prisma.product.update({
            where: { id: product.id },
            data: { image3: null, image3Key: null, image3MimeType: null, hasImage3: false, imagesUpdatedAt: new Date() },
            select: { imagesUpdatedAt: true },
          }));
    if (previousKey) {
      await this.r2.deleteObject(previousKey);
    }
    return { imagesUpdatedAt: updated.imagesUpdatedAt };
  }

  /** Binar rasm. NETWORK_ADMIN har qanday filialning rasmini ko'ra oladi (ro'yxat kabi). Bo'sh o'rin uchun caller NotFoundException tashlaydi. */
  async readImage(scope: TenantScope, id: string, position: string) {
    const pos = parsePosition(position);
    const branchFilter = scope.branchId ? { branchId: scope.branchId } : {};

    if (pos === 1) {
      const product = await this.prisma.product.findFirst({
        where: { id, organizationId: scope.organizationId, ...branchFilter },
        select: { image1: true, image1Key: true, image1MimeType: true },
      });
      if (!product) {
        throw new NotFoundException("Mahsulot topilmadi");
      }
      return { image: product.image1, key: product.image1Key, mimeType: product.image1MimeType };
    }
    if (pos === 2) {
      const product = await this.prisma.product.findFirst({
        where: { id, organizationId: scope.organizationId, ...branchFilter },
        select: { image2: true, image2Key: true, image2MimeType: true },
      });
      if (!product) {
        throw new NotFoundException("Mahsulot topilmadi");
      }
      return { image: product.image2, key: product.image2Key, mimeType: product.image2MimeType };
    }
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId: scope.organizationId, ...branchFilter },
      select: { image3: true, image3Key: true, image3MimeType: true },
    });
    if (!product) {
      throw new NotFoundException("Mahsulot topilmadi");
    }
    return { image: product.image3, key: product.image3Key, mimeType: product.image3MimeType };
  }

  async sell(scope: TenantScope, id: string, dto: SellProductDto) {
    const product = await this.requireWritableProduct(scope, id);
    if (product.quantity < dto.quantity) {
      throw new BadRequestException(`Omborda yetarli mahsulot yo'q (mavjud: ${product.quantity})`);
    }

    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: product.id },
        data: { quantity: { decrement: dto.quantity } },
      }),
      this.prisma.productSale.create({
        data: {
          productId: product.id,
          quantity: dto.quantity,
          soldByUserId: scope.userId,
        },
      }),
    ]);

    return this.prisma.product.findUniqueOrThrow({ where: { id: product.id } });
  }

  /** Yozish uchun: mahsulot shu tashkilot/filialda. */
  private async requireWritableProduct(scope: TenantScope, id: string) {
    const branchId = requireTeachingScope(scope);
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
    });
    if (!product) {
      throw new NotFoundException("Mahsulot topilmadi");
    }
    return product;
  }
}
