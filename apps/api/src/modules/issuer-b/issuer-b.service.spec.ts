import { Test, TestingModule } from '@nestjs/testing';
import { IssuerBService } from './issuer-b.service';

describe('IssuerBService', () => {
  let service: IssuerBService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IssuerBService],
    }).compile();

    service = module.get<IssuerBService>(IssuerBService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
