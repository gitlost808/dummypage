import { constants } from '../constants';
import { LeaderboardClient } from './client';

export const leaderboard = new LeaderboardClient(constants.leaderboardApiUrl);
