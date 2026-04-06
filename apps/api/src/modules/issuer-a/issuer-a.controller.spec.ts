import { Test, TestingModule } from '@nestjs/testing';
import { IssuerAController } from './issuer-a.controller';

describe('IssuerAController', () => {
  let controller: IssuerAController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IssuerAController],
    }).compile();

    controller = module.get<IssuerAController>(IssuerAController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
