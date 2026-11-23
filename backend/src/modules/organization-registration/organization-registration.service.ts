import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationRegistrationDto } from './dto/create-registration.dto';
import { RegistrationStatus } from '@prisma/client';

@Injectable()
export class OrganizationRegistrationService {
  private readonly logger = new Logger(OrganizationRegistrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateReference(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `REG-${today}-${randomHex}`;
  }

  async register(dto: CreateOrganizationRegistrationDto) {
    const orgName = dto.organizationName.trim();
    const orgEmail = dto.organizationEmail.toLowerCase().trim();
    const adminEmail = dto.adminEmail.toLowerCase().trim();

    // 1. Prevent duplicate active organizations by name
    const existingOrg = await this.prisma.organization.findFirst({
      where: {
        name: { equals: orgName, mode: 'insensitive' },
      },
    });

    if (existingOrg) {
      throw new ConflictException(
        'An active healthcare organization with this name already exists.',
      );
    }

    // 2. Prevent duplicate registrations that are already verified or under review
    const existingVerifiedReg = await this.prisma.organizationRegistration.findFirst({
      where: {
        organizationEmail: orgEmail,
        status: {
          in: [
            RegistrationStatus.PENDING_APPROVAL,
            RegistrationStatus.APPROVED,
            RegistrationStatus.PROVISIONING,
            RegistrationStatus.ACTIVE,
          ],
        },
      },
    });

    if (existingVerifiedReg) {
      throw new ConflictException(
        `An application for ${orgEmail} has already been verified and is currently ${existingVerifiedReg.status.toLowerCase().replace(/_/g, ' ')} under reference ${existingVerifiedReg.reference}.`,
      );
    }

    // 3. Cryptographic token generation
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // 4. If an unverified registration exists for this email, refresh it with latest submitted info & fresh token
    const existingUnverifiedReg = await this.prisma.organizationRegistration.findFirst({
      where: {
        organizationEmail: orgEmail,
        status: RegistrationStatus.PENDING_EMAIL_VERIFICATION,
      },
    });

    if (existingUnverifiedReg) {
      const updated = await this.prisma.organizationRegistration.update({
        where: { id: existingUnverifiedReg.id },
        data: {
          organizationName: orgName,
          organizationType: dto.organizationType,
          requestedEdition: dto.requestedEdition,
          healthcareSpecialization: (dto.healthcareSpecialization || dto.specialization)?.trim(),
          licenseNumber: (dto.licenseNumber || dto.registrationNumber)?.trim(),
          contactPhone: dto.contactPhone.trim(),
          country: dto.country?.trim() || 'India',
          state: dto.state?.trim() || null,
          city: dto.city.trim(),
          address: dto.address?.trim() || null,
          postalCode: dto.postalCode?.trim() || null,
          website: dto.website?.trim() || null,
          adminFullName: dto.adminFullName.trim(),
          adminEmail,
          adminPhone: dto.adminPhone?.trim() || null,
          adminDesignation: dto.adminDesignation?.trim() || 'Administrator',
          emailVerificationToken: tokenHash,
          emailVerificationExpiresAt: expiresAt,
          verificationAttempts: { increment: 1 },
          lastVerificationSentAt: new Date(),
        },
      });

      this.logger.log(
        `Refreshed unverified registration: ${updated.organizationName} (${updated.reference}). Verification email dispatched.`,
      );

      return {
        success: true,
        reference: updated.reference,
        organizationName: updated.organizationName,
        status: updated.status,
        emailVerificationExpiresAt: expiresAt,
        verificationToken: rawToken,
      };
    }

    // 5. Create new registration
    const reference = this.generateReference();

    const registration = await this.prisma.organizationRegistration.create({
      data: {
        reference,
        organizationName: orgName,
        organizationType: dto.organizationType,
        requestedEdition: dto.requestedEdition,
        healthcareSpecialization: (dto.healthcareSpecialization || dto.specialization)?.trim(),
        licenseNumber: (dto.licenseNumber || dto.registrationNumber)?.trim(),
        organizationEmail: orgEmail,
        contactPhone: dto.contactPhone.trim(),
        country: dto.country?.trim() || 'India',
        state: dto.state?.trim() || null,
        city: dto.city.trim(),
        address: dto.address?.trim() || null,
        postalCode: dto.postalCode?.trim() || null,
        website: dto.website?.trim() || null,
        adminFullName: dto.adminFullName.trim(),
        adminEmail,
        adminPhone: dto.adminPhone?.trim() || null,
        adminDesignation: dto.adminDesignation?.trim() || 'Administrator',
        status: RegistrationStatus.PENDING_EMAIL_VERIFICATION,
        isEmailVerified: false,
        emailVerificationToken: tokenHash,
        emailVerificationExpiresAt: expiresAt,
        verificationAttempts: 1,
        lastVerificationSentAt: new Date(),
      },
    });

    this.logger.log(
      `New organization registration submitted: ${registration.organizationName} (${registration.reference}). Verification email dispatched.`,
    );

    return {
      success: true,
      reference: registration.reference,
      organizationName: registration.organizationName,
      status: registration.status,
      emailVerificationExpiresAt: expiresAt,
      // Raw token returned for automated testing & development verification
      verificationToken: rawToken,
    };
  }

  async verifyEmail(token: string) {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Verification token is required.');
    }

    const tokenHash = this.hashToken(token.trim());

    const registration = await this.prisma.organizationRegistration.findFirst({
      where: {
        emailVerificationToken: tokenHash,
        status: RegistrationStatus.PENDING_EMAIL_VERIFICATION,
      },
    });

    if (!registration) {
      throw new BadRequestException('Invalid or expired email verification token.');
    }

    if (
      registration.emailVerificationExpiresAt &&
      registration.emailVerificationExpiresAt < new Date()
    ) {
      throw new BadRequestException(
        'Email verification token has expired. Please request a new verification email.',
      );
    }

    const updated = await this.prisma.organizationRegistration.update({
      where: { id: registration.id },
      data: {
        status: RegistrationStatus.PENDING_APPROVAL,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
    });

    this.logger.log(
      `Email verified for organization registration ${updated.reference}. Status transitioned to PENDING_APPROVAL.`,
    );

    return {
      success: true,
      reference: updated.reference,
      organizationName: updated.organizationName,
      status: updated.status,
      isEmailVerified: updated.isEmailVerified,
    };
  }

  async resendVerification(referenceOrEmail: string) {
    if (!referenceOrEmail || typeof referenceOrEmail !== 'string') {
      throw new BadRequestException('Reference or email is required.');
    }

    const trimmed = referenceOrEmail.trim();

    const registration = await this.prisma.organizationRegistration.findFirst({
      where: {
        OR: [
          { reference: trimmed },
          { organizationEmail: trimmed.toLowerCase() },
          { adminEmail: trimmed.toLowerCase() },
        ],
        status: RegistrationStatus.PENDING_EMAIL_VERIFICATION,
      },
    });

    if (!registration) {
      throw new NotFoundException(
        'No pending registration found requiring email verification for the provided reference or email.',
      );
    }

    const lastResend = registration.lastVerificationSentAt
      ? registration.lastVerificationSentAt.getTime()
      : 0;
    const now = Date.now();

    // Rate limiting: 2 minutes between attempts
    if (now - lastResend < 2 * 60 * 1000) {
      const waitSeconds = Math.ceil((2 * 60 * 1000 - (now - lastResend)) / 1000);
      throw new BadRequestException(
        `Please wait ${waitSeconds} seconds before requesting another verification email.`,
      );
    }

    // Limit maximum attempts (5 max)
    if (registration.verificationAttempts >= 5) {
      throw new BadRequestException(
        'Maximum verification resend attempts exceeded. Please contact platform support.',
      );
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.organizationRegistration.update({
      where: { id: registration.id },
      data: {
        emailVerificationToken: tokenHash,
        emailVerificationExpiresAt: expiresAt,
        verificationAttempts: { increment: 1 },
        lastVerificationSentAt: new Date(),
      },
    });

    this.logger.log(
      `Resent verification token for registration ${registration.reference} (Attempt ${registration.verificationAttempts + 1}/5).`,
    );

    return {
      success: true,
      message: 'A fresh verification token has been generated and dispatched.',
      reference: registration.reference,
      verificationToken: rawToken,
    };
  }

  async getStatus(reference: string) {
    if (!reference || typeof reference !== 'string') {
      throw new BadRequestException('Registration reference is required.');
    }

    const registration = await this.prisma.organizationRegistration.findUnique({
      where: { reference: reference.trim() },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with reference "${reference}" not found.`);
    }

    return {
      reference: registration.reference,
      organizationName: registration.organizationName,
      organizationType: registration.organizationType,
      requestedEdition: registration.requestedEdition,
      status: registration.status,
      isEmailVerified: registration.isEmailVerified,
      rejectionReason:
        registration.status === RegistrationStatus.REJECTED
          ? registration.rejectionReason
          : null,
      createdAt: registration.createdAt,
      organizationId: registration.organizationId
        ? registration.organizationId.toString()
        : null,
    };
  }
}
