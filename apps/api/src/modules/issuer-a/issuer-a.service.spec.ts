import { Test, TestingModule } from '@nestjs/testing';
import { IssuerAService } from './issuer-a.service';

describe('IssuerAService', () => {
  let service: IssuerAService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IssuerAService],
    }).compile();

    service = module.get<IssuerAService>(IssuerAService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
