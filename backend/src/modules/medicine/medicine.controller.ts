import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HospitalPermission } from '../../common/constants/permissions.enum';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MedicineService } from './medicine.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { QueryMedicineDto } from './dto/query-medicine.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import {
  CreateDosageFormDto,
  CreateManufacturerDto,
  CreateMeasurementUnitDto,
  CreateSupplierDto,
  UpdateManufacturerDto,
  UpdateSupplierDto,
} from './dto/supporting-catalogue.dto';

@ApiTags('Medicine Catalogue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('medicines')
export class MedicineController {
  constructor(private readonly medicineService: MedicineService) {}

  // ===========================================================================
  // 1. MEDICINES
  // ===========================================================================

  @Get()
  @RequirePermissions(HospitalPermission.MEDICINE_VIEW)
  @ApiOperation({ summary: 'Paginated list of medicines with filtering and search' })
  @ApiResponse({ status: 200, description: 'Filtered medicines retrieved successfully' })
  findAll(@Query() query: QueryMedicineDto) {
    return this.medicineService.findAll(query);
  }

  @Get('search')
  @RequirePermissions(HospitalPermission.MEDICINE_VIEW)
  @ApiOperation({ summary: 'Search active medicines for prescribing and dispensing autocomplete' })
  search(@Query('q') q: string) {
    return this.medicineService.search(q);
  }

  // ===========================================================================
  // 2. METADATA & SUPPORTING CATALOGUE
  // (Declared BEFORE :id route to prevent route parameter collision)
  // ===========================================================================

  // Categories
  @Get('meta/categories')
  @RequirePermissions(HospitalPermission.MEDICINE_VIEW)
  @ApiOperation({ summary: 'List all medicine categories with item counts' })
  findAllCategories() {
    return this.medicineService.findAllCategories();
  }

  @Post('meta/categories')
  @RequirePermissions(HospitalPermission.MEDICINE_ADD)
  @ApiOperation({ summary: 'Create new medicine category' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.medicineService.createCategory(dto);
  }

  @Put('meta/categories/:id')
  @RequirePermissions(HospitalPermission.MEDICINE_UPDATE)
  @ApiOperation({ summary: 'Update medicine category' })
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.medicineService.updateCategory(id, dto);
  }

  @Delete('meta/categories/:id')
  @RequirePermissions(HospitalPermission.MEDICINE_DELETE)
  @ApiOperation({ summary: 'Delete medicine category (Blocked if medicines exist)' })
  removeCategory(@Param('id', ParseIntPipe) id: number) {
    return this.medicineService.removeCategory(id);
  }

  // Manufacturers
  @Get('meta/manufacturers')
  @RequirePermissions(HospitalPermission.MEDICINE_VIEW)
  @ApiOperation({ summary: 'List all pharmaceutical manufacturers' })
  findAllManufacturers() {
    return this.medicineService.findAllManufacturers();
  }

  @Post('meta/manufacturers')
  @RequirePermissions(HospitalPermission.MEDICINE_ADD)
  @ApiOperation({ summary: 'Create pharmaceutical manufacturer' })
  createManufacturer(@Body() dto: CreateManufacturerDto) {
    return this.medicineService.createManufacturer(dto);
  }

  @Put('meta/manufacturers/:id')
  @RequirePermissions(HospitalPermission.MEDICINE_UPDATE)
  @ApiOperation({ summary: 'Update pharmaceutical manufacturer' })
  updateManufacturer(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateManufacturerDto) {
    return this.medicineService.updateManufacturer(id, dto);
  }

  @Delete('meta/manufacturers/:id')
  @RequirePermissions(HospitalPermission.MEDICINE_DELETE)
  @ApiOperation({ summary: 'Delete manufacturer (Blocked if medicines linked)' })
  removeManufacturer(@Param('id', ParseIntPipe) id: number) {
    return this.medicineService.removeManufacturer(id);
  }

  // Dosage Forms
  @Get('meta/dosage-forms')
  @RequirePermissions(HospitalPermission.MEDICINE_VIEW)
  @ApiOperation({ summary: 'List all dosage forms (Tablet, Syrup, etc.)' })
  findAllDosageForms() {
    return this.medicineService.findAllDosageForms();
  }

  @Post('meta/dosage-forms')
  @RequirePermissions(HospitalPermission.MEDICINE_ADD)
  @ApiOperation({ summary: 'Create dosage form' })
  createDosageForm(@Body() dto: CreateDosageFormDto) {
    return this.medicineService.createDosageForm(dto);
  }

  @Delete('meta/dosage-forms/:id')
  @RequirePermissions(HospitalPermission.MEDICINE_DELETE)
  @ApiOperation({ summary: 'Delete dosage form (Blocked if medicines linked)' })
  removeDosageForm(@Param('id', ParseIntPipe) id: number) {
    return this.medicineService.removeDosageForm(id);
  }

  // Measurement Units
  @Get('meta/units')
  @RequirePermissions(HospitalPermission.MEDICINE_VIEW)
  @ApiOperation({ summary: 'List all measurement units (mg, ml, etc.)' })
  findAllUnits() {
    return this.medicineService.findAllUnits();
  }

  @Post('meta/units')
  @RequirePermissions(HospitalPermission.MEDICINE_ADD)
  @ApiOperation({ summary: 'Create measurement unit' })
  createUnit(@Body() dto: CreateMeasurementUnitDto) {
    return this.medicineService.createUnit(dto);
  }

  @Delete('meta/units/:id')
  @RequirePermissions(HospitalPermission.MEDICINE_DELETE)
  @ApiOperation({ summary: 'Delete measurement unit' })
  removeUnit(@Param('id', ParseIntPipe) id: number) {
    return this.medicineService.removeUnit(id);
  }

  // Suppliers
  @Get('meta/suppliers')
  @RequirePermissions(HospitalPermission.MEDICINE_VIEW)
  @ApiOperation({ summary: 'List pharmaceutical suppliers' })
  findAllSuppliers() {
    return this.medicineService.findAllSuppliers();
  }

  @Post('meta/suppliers')
  @RequirePermissions(HospitalPermission.MEDICINE_ADD)
  @ApiOperation({ summary: 'Create supplier' })
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.medicineService.createSupplier(dto);
  }

  @Put('meta/suppliers/:id')
  @RequirePermissions(HospitalPermission.MEDICINE_UPDATE)
  @ApiOperation({ summary: 'Update supplier' })
  updateSupplier(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierDto) {
    return this.medicineService.updateSupplier(id, dto);
  }

  @Delete('meta/suppliers/:id')
  @RequirePermissions(HospitalPermission.MEDICINE_DELETE)
  @ApiOperation({ summary: 'Delete supplier' })
  removeSupplier(@Param('id', ParseIntPipe) id: number) {
    return this.medicineService.removeSupplier(id);
  }

  // ===========================================================================
  // 3. MEDICINE ITEM OPERATIONS
  // ===========================================================================

  @Get(':id')
  @RequirePermissions(HospitalPermission.MEDICINE_VIEW)
  @ApiOperation({ summary: 'Get single medicine details by ID' })
  @ApiParam({ name: 'id', example: 1 })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.medicineService.findById(id);
  }

  @Post()
  @RequirePermissions(HospitalPermission.MEDICINE_ADD)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a new medicine to the hospital catalogue' })
  create(@Body() dto: CreateMedicineDto) {
    return this.medicineService.create(dto);
  }

  @Put(':id')
  @RequirePermissions(HospitalPermission.MEDICINE_UPDATE)
  @ApiOperation({ summary: 'Update existing medicine in the catalogue' })
  @ApiParam({ name: 'id', example: 1 })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMedicineDto) {
    return this.medicineService.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(HospitalPermission.MEDICINE_UPDATE)
  @ApiOperation({ summary: 'Activate or deactivate a medicine' })
  @ApiParam({ name: 'id', example: 1 })
  toggleActive(
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.medicineService.toggleActive(id, isActive);
  }

  @Delete(':id')
  @RequirePermissions(HospitalPermission.MEDICINE_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove medicine (Blocked if prescribed or sold)' })
  @ApiParam({ name: 'id', example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.medicineService.remove(id);
  }
}
