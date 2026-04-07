import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.use(
    express.text({
      type: ['application/xml', 'text/xml'],
      limit: '1mb',
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();