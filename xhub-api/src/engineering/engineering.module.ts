import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { VersionsController } from './versions.controller';
import { VersionsService } from './versions.service';
import { FeaturesController } from './features.controller';
import { FeaturesService } from './features.service';
import { BacklogController } from './backlog.controller';
import { BacklogService } from './backlog.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { TestSuitesController } from './test-suites.controller';
import { TestSuitesService } from './test-suites.service';
import { TestCasesController } from './test-cases.controller';
import { TestCasesService } from './test-cases.service';
import { TestResultsController } from './test-results.controller';
import { TestResultsService } from './test-results.service';
import { DefectsController } from './defects.controller';
import { DefectsService } from './defects.service';
import { CiController } from './ci.controller';
import { CiService } from './ci.service';
import { ControlsController } from './controls.controller';
import { ControlsService } from './controls.service';
import { AiGovernanceController } from './ai-governance.controller';
import { AiGovernanceService } from './ai-governance.service';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';

/**
 * Engineering Governance ("Phát triển & Chất lượng") — DG-01 Product
 * Registry + Version core, DG-02 Feature/Backlog, DG-03-lite Document
 * catalog, DG-04-lite Test hierarchy, DG-05 Defect FSM, DG-06 CI/build
 * ingestion, DG-09 Unified Control Framework, DG-10 AI Governance, DG-11
 * Privacy/DPIA, DG-12-lite Evidence Ledger (see
 * docs/implementation/engineering-hub/IMPLEMENTATION_PLAN.md +
 * ADR_GOVERNANCE_RECONCILIATION.md for why DG-09..12 are additive-only,
 * not a redesign of DG-01/02/04/05). XHub Platform only — see
 * ADR_MODULE_OWNERSHIP.md. Never imports XofficePrismaModule; registered in
 * platform-app.module.ts only. AIWorkOrder (DG-07) and ecosystem rollout
 * (DG-08) are later phases, not part of this module yet.
 */
@Module({
  controllers: [
    ProductsController,
    VersionsController,
    FeaturesController,
    BacklogController,
    DocumentsController,
    TestSuitesController,
    TestCasesController,
    TestResultsController,
    DefectsController,
    CiController,
    ControlsController,
    AiGovernanceController,
    PrivacyController,
    EvidenceController,
  ],
  providers: [
    ProductsService,
    VersionsService,
    FeaturesService,
    BacklogService,
    DocumentsService,
    TestSuitesService,
    TestCasesService,
    TestResultsService,
    DefectsService,
    CiService,
    ControlsService,
    AiGovernanceService,
    PrivacyService,
    EvidenceService,
  ],
})
export class EngineeringModule {}
