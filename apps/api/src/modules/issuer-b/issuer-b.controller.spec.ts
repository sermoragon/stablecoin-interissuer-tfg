import { Test, TestingModule } from '@nestjs/testing';
import { IssuerBController } from './issuer-b.controller';

describe('IssuerBController', () => {
  let controller: IssuerBController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IssuerBController],
    }).compile();

    controller = module.get<IssuerBController>(IssuerBController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
