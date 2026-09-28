import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthPayload, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminAiTelemetryService } from './admin-ai-telemetry.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAnalyticsQueryDto } from './dto/admin-analytics-query.dto';
import { AdminBillingService } from './admin-billing.service';
import { AdminCommunityService } from './admin-community.service';
import { AdminCommunityQueryDto } from './dto/admin-community-query.dto';
import { UpdateAdminCommunityPublicationDto } from './dto/update-admin-community.dto';
import { AdminInvitationsService } from './admin-invitations.service';
import { AdminBillingQueryDto } from './dto/admin-billing-query.dto';
import { AdminUsersService } from './admin-users.service';
import { AdminAiTelemetryQueryDto } from './dto/admin-ai-telemetry-query.dto';
import { AdminService } from './admin.service';
import { BulkAdminInvitationStatusDto, UpdateAdminInvitationStatusDto } from './dto/update-admin-invitation.dto';
import { AdminInvitationsQueryDto } from './dto/admin-invitations-query.dto';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserRoleDto, UpdateAdminUserStatusDto } from './dto/update-admin-user.dto';
import { AdminOverviewQueryDto } from './dto/admin-overview-query.dto';

@Controller({ path: 'admin', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly users: AdminUsersService,
    private readonly invitations: AdminInvitationsService,
    private readonly telemetry: AdminAiTelemetryService,
    private readonly billing: AdminBillingService,
    private readonly community: AdminCommunityService,
    private readonly analyticsPage: AdminAnalyticsService
  ) {}

  @Get('overview')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  overview(@Query() query: AdminOverviewQueryDto) {
    return this.admin.getOverview(query);
  }

  @Get('overview/generations')
  overviewGenerations(@Query() query: AdminOverviewQueryDto) {
    return this.admin.getGenerations(query.page ?? 1, query.limit ?? 6);
  }

  @Get('users')
  usersList(@Query() query: AdminUsersQueryDto) {
    return this.users.listUsers(query);
  }

  @Get('users/summary')
  usersSummary() {
    return this.users.getUsersSummary();
  }

  @Get('users/table')
  usersTable(@Query() query: AdminUsersQueryDto) {
    return this.users.getUsersTable(query);
  }

  @Post('users')
  createUser(@Body() dto: CreateAdminUserDto) {
    return this.users.createUser(dto);
  }

  @Patch('users/:id')
  setUserStatus(
    @CurrentUser() admin: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAdminUserStatusDto
  ) {
    return this.users.setStatus(admin.sub, id, dto.isActive);
  }

  @Patch('users/:id/role')
  setUserRole(
    @CurrentUser() admin: AuthPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAdminUserRoleDto
  ) {
    return this.users.setRole(admin.sub, id, dto.role);
  }

  @Delete('users/:id')
  removeUser(@CurrentUser() admin: AuthPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.removeUser(admin.sub, id);
  }

  @Get('invitations')
  invitationsList(@Query() query: AdminInvitationsQueryDto) {
    return this.invitations.listInvitations(query);
  }

  @Get('invitations/summary')
  invitationsSummary() {
    return this.invitations.getInvitationsSummary();
  }

  @Get('invitations/table')
  invitationsTable(@Query() query: AdminInvitationsQueryDto) {
    return this.invitations.getInvitationsTable(query);
  }

  @Get('invitations/top-viewed')
  topViewed() {
    return this.invitations.topViewed();
  }

  @Get('invitations/:id/analytics')
  invitationAnalytics(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.invitations.analyticsFor(id);
  }

  @Patch('invitations/bulk-status')
  bulkInvitationStatus(@Body() dto: BulkAdminInvitationStatusDto) {
    return this.invitations.bulkStatus(dto.ids, dto.status);
  }

  @Patch('invitations/:id/status')
  setInvitationStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAdminInvitationStatusDto
  ) {
    return this.invitations.setStatus(id, dto.status);
  }

  @Delete('invitations/:id')
  removeInvitation(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.invitations.remove(id);
  }

  @Get('ai-telemetry')
  aiTelemetry(@Query() query: AdminAiTelemetryQueryDto) {
    return this.telemetry.getTelemetry(query);
  }

  @Get('ai-telemetry/failures')
  aiFailures(@Query() query: AdminAiTelemetryQueryDto) {
    return this.telemetry.getFailures(query.failPage ?? 1, query.failLimit ?? 5);
  }

  @Get('billing')
  billingOverview(@Query() query: AdminBillingQueryDto) {
    return this.billing.getBilling(query);
  }

  @Get('billing/transactions')
  billingTransactions(@Query() query: AdminBillingQueryDto) {
    return this.billing.getTransactions(query.txPage ?? 1, query.txLimit ?? 6);
  }

  @Get('community')
  communityList(@Query() query: AdminCommunityQueryDto) {
    return this.community.listDesigns(query);
  }

  @Get('community/summary')
  communitySummary() {
    return this.community.getCommunitySummary();
  }

  @Get('community/table')
  communityTable(@Query() query: AdminCommunityQueryDto) {
    return this.community.getCommunityTable(query);
  }

  @Patch('community/:id/publication')
  setCommunityPublication(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAdminCommunityPublicationDto
  ) {
    return this.community.setPublication(id, dto.isPublished);
  }

  @Delete('community/:id')
  removeCommunity(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.community.remove(id);
  }

  @Get('analytics')
  analyticsOverview(@Query() query: AdminAnalyticsQueryDto) {
    return this.analyticsPage.getAnalytics(query);
  }
}
