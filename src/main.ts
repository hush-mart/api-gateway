import * as process from 'node:process';

import { setupGlobalConsoleLogging } from '@daechanjo/log';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule } from '@nestjs/swagger';
import * as dotenv from 'dotenv';
import { initializeTransactionalContext } from 'typeorm-transactional';

import { AppModule } from './app.module';
import { swaggerConfig } from './config/swagger.config';
import { AppConfig } from './config/app.config';

dotenv.config({
  path: '/Users/daechanjo/codes/project/auto-store/.env',
});

async function bootstrap() {
  const appConfig = AppConfig.getInstance();
  appConfig.appName = 'API-Gateway';
  initializeTransactionalContext();
  setupGlobalConsoleLogging({ appName: appConfig.appName });

  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [String(process.env.RABBITMQ_URL)],
      queue: 'gateway-queue',
      queueOptions: { durable: false },
    },
  });

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // 유효성 검사 전에 원시 값을 유지
      validateCustomDecorators: false,
      skipMissingProperties: true,
      whitelist: true,
    }),
  );
  app.setGlobalPrefix('/api');
  const server = app.getHttpAdapter().getInstance();

  server.get('/health', (req: any, res: any) => {
    res.status(200).send('OK');
  });

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.startAllMicroservices();
  await app.listen(9000, '0.0.0.0');

  console.log('API 게이트웨이 서비스 시작');
}
bootstrap();
