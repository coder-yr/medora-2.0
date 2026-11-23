import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationStatusDto, OrganizationTypeDto } from './dto/create-organization.dto';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prisma: PrismaService;

  const mockDefaultOrg = {
    id: 1n,
    name: 'Medora Healthcare System',
    code: 'MEDORA-HOSP-01',
    type: 'HOSPITAL',
    status: 'ACTIVE',
    createdAt: new Date('2026-11-20T10:00:00Z'),
    updatedAt: new Date('2026-11-20T10:00:00Z'),
    deletedAt: null,
    settings: {
      id: 1n,
      organizationId: 1n,
      legalName: 'Medora Healthcare System (Pvt) Ltd',
      email: 'info@medora.hospital',
      defaultCurrency: 'INR',
      defaultTimezone: 'Asia/Karachi',
    },
    branches: [
      { id: 1n, code: 'MAIN', name: 'Main Campus', active: true },
      { id: 3n, code: 'CITY', name: 'City Clinic', active: true },
    ],
    _count: { branches: 2, users: 17, userMemberships: 17 },
  };

  const mockPrismaService: any = {
    organization: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organizationSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    userOrganizationMembership: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    hospitalBranch: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('1. Default Hospital Mapping & Retrieval', () => {
    it('should find existing default hospital organization by code', async () => {
      mockPrismaService.organization.findFirst.mockResolvedValue(mockDefaultOrg);

      const result = await service.findByCode('MEDORA-HOSP-01');

      expect(result.id).toBe('1');
      expect(result.code).toBe('MEDORA-HOSP-01');
      expect(result.type).toBe('HOSPITAL');
      expect(result.settings?.defaultCurrency).toBe('INR');
      expect(result.branches).toHaveLength(2);
    });

    it('should return 404 when organization code does not exist', async () => {
      mockPrismaService.organization.findFirst.mockResolvedValue(null);

      await expect(service.findByCode('NON-EXISTENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. Organization Creation & Code Uniqueness', () => {
    it('should successfully create a new independent Clinic organization and auto-provision settings', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null);
      const newOrg = {
        id: 2n,
        name: 'Dr. Tariq Pediatric Clinic',
        code: 'TARIQ-PEDS',
        type: 'CLINIC',
        status: 'ACTIVE',
        settings: { legalName: 'Dr. Tariq Pediatric Clinic', defaultCurrency: 'INR' },
      };
      mockPrismaService.organization.create.mockResolvedValue(newOrg);
      mockPrismaService.organizationSettings.create.mockResolvedValue({ id: 2n, organizationId: 2n });
      mockPrismaService.organization.findFirst.mockResolvedValue(newOrg);

      const created = await service.create(
        {
          name: 'Dr. Tariq Pediatric Clinic',
          code: 'TARIQ-PEDS',
          type: OrganizationTypeDto.CLINIC,
          status: OrganizationStatusDto.ACTIVE,
        },
        3n, // creator user ID
      );

      expect(mockPrismaService.organization.create).toHaveBeenCalledWith({
        data: {
          name: 'Dr. Tariq Pediatric Clinic',
          code: 'TARIQ-PEDS',
          type: 'CLINIC',
          status: 'ACTIVE',
        },
      });
      expect(mockPrismaService.organizationSettings.create).toHaveBeenCalled();
      expect(mockPrismaService.userOrganizationMembership.upsert).toHaveBeenCalledWith({
        where: {
          userId_organizationId: {
            userId: 3n,
            organizationId: 2n,
          },
        },
        create: {
          userId: 3n,
          organizationId: 2n,
          isDefault: true,
          isActive: true,
          accessRole: 'OrganizationAdmin',
        },
        update: {
          isActive: true,
        },
      });
      expect(created.code).toBe('TARIQ-PEDS');
    });

    it('should throw ConflictException on duplicate organization code / slug', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(mockDefaultOrg);

      await expect(
        service.create({
          name: 'Duplicate Hospital',
          code: 'MEDORA-HOSP-01',
          type: OrganizationTypeDto.HOSPITAL,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('3. User Organization Memberships & Roaming', () => {
    it('should list all organizations an authenticated doctor belongs to', async () => {
      mockPrismaService.userOrganizationMembership.findMany.mockResolvedValue([
        {
          id: 101n,
          userId: 3n,
          organizationId: 1n,
          isDefault: true,
          accessRole: 'Doctor',
          assignedAt: new Date(),
          organization: mockDefaultOrg,
        },
        {
          id: 102n,
          userId: 3n,
          organizationId: 2n,
          isDefault: false,
          accessRole: 'VisitingConsultant',
          assignedAt: new Date(),
          organization: {
            id: 2n,
            name: 'Clifton Diagnostic Center',
            code: 'CLIFTON-DX',
            type: 'DIAGNOSTIC_CENTER',
            status: 'ACTIVE',
            settings: { defaultCurrency: 'INR' },
          },
        },
      ]);

      const userOrgs = await service.getUserOrganizations(3n);

      expect(userOrgs).toHaveLength(2);
      expect(userOrgs[0].organization.code).toBe('MEDORA-HOSP-01');
      expect(userOrgs[0].isDefault).toBe(true);
      expect(userOrgs[1].organization.code).toBe('CLIFTON-DX');
      expect(userOrgs[1].accessRole).toBe('VisitingConsultant');
    });
  });

  describe('4. Branch Ownership & Scoping by Organization', () => {
    it('should retrieve branches strictly belonging to the target organization', async () => {
      mockPrismaService.organization.findFirst.mockResolvedValue(mockDefaultOrg);
      mockPrismaService.hospitalBranch.findMany.mockResolvedValue([
        { id: 1n, organizationId: 1n, code: 'MAIN', name: 'Main Campus', active: true },
        { id: 3n, organizationId: 1n, code: 'CITY', name: 'City Clinic', active: true },
      ]);

      const branches = await service.getOrganizationBranches(1n);

      expect(branches).toHaveLength(2);
      expect(branches[0].code).toBe('MAIN');
      expect(branches[1].code).toBe('CITY');
      expect(branches.every((b) => b.organizationId === '1')).toBe(true);
    });
  });

  describe('5. Organization Settings Management', () => {
    it('should retrieve organization settings and format BigInt safely', async () => {
      mockPrismaService.organizationSettings.findUnique.mockResolvedValue({
        id: 10n,
        organizationId: 1n,
        legalName: 'Medora Healthcare Trust',
        taxNumber: 'NTN-123456',
        defaultCurrency: 'INR',
        defaultTimezone: 'Asia/Karachi',
      });

      const settings = await service.getSettings(1n);

      expect(settings.id).toBe('10');
      expect(settings.organizationId).toBe('1');
      expect(settings.legalName).toBe('Medora Healthcare Trust');
      expect(settings.taxNumber).toBe('NTN-123456');
    });

    it('should update organization settings and track updater user ID', async () => {
      mockPrismaService.organization.findFirst.mockResolvedValue(mockDefaultOrg);
      mockPrismaService.organizationSettings.upsert.mockResolvedValue({});
      mockPrismaService.organizationSettings.findUnique.mockResolvedValue({
        id: 10n,
        organizationId: 1n,
        legalName: 'Updated Hospital Name Ltd',
        taxNumber: 'NTN-999999',
        defaultCurrency: 'USD',
        defaultTimezone: 'UTC',
      });

      const updated = await service.updateSettings(
        1n,
        {
          legalName: 'Updated Hospital Name Ltd',
          taxNumber: 'NTN-999999',
          defaultCurrency: 'USD',
          defaultTimezone: 'UTC',
        },
        1n, // SuperAdmin updater
      );

      expect(updated.legalName).toBe('Updated Hospital Name Ltd');
      expect(updated.defaultCurrency).toBe('USD');
      expect(mockPrismaService.organizationSettings.upsert).toHaveBeenCalled();
    });
  });
});
