import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth.routes';
import { workItemsRouter } from './routes/workItems.routes';
import { eventsRouter } from './routes/events.routes';
import { teamsRouter } from './routes/teams.routes';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/work-items', workItemsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/teams', teamsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling (must be last)
app.use(errorHandler);

export { app };
