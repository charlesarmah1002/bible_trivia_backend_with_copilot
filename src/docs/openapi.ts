const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: Record<string, unknown>) => ({
  content: { 'application/json': { schema } },
});
const response = (description: string, schema?: Record<string, unknown>) => ({
  description,
  ...(schema ? json(schema) : {}),
});
const bearer = [{ bearerAuth: [] }];
const adminBearer = [{ bearerAuth: [] }];

export const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Bible Trivia API',
    version: '1.0.0',
    description:
      'Authenticated Bible trivia API with solo games, server-authoritative scoring, leaderboards, suggestions, and role-protected administration.',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development server' },
  ],
  tags: [
    { name: 'Health' },
    { name: 'Authentication' },
    { name: 'Users' },
    { name: 'Questions' },
    { name: 'Games' },
    { name: 'Leaderboard' },
    { name: 'Suggestions' },
    { name: 'Admin' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          '200': response('Service is healthy', {
            type: 'object',
            properties: { status: { type: 'string', example: 'ok' } },
          }),
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a user',
        requestBody: json(ref('RegisterRequest')),
        responses: {
          '201': response('Registered user and tokens', ref('AuthResponse')),
          '400': response('Invalid registration'),
          '409': response('Username or email already exists'),
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Log in with username or email',
        requestBody: json(ref('LoginRequest')),
        responses: {
          '200': response('Authenticated user and tokens', ref('AuthResponse')),
          '400': response('Invalid request'),
          '401': response('Invalid credentials or inactive account'),
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Rotate a refresh token',
        requestBody: json(ref('RefreshRequest')),
        responses: {
          '200': response('Rotated tokens', ref('AuthResponse')),
          '401': response('Invalid, expired, or revoked token'),
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Revoke a refresh token',
        requestBody: json(ref('RefreshRequest')),
        responses: {
          '204': response('Token revoked'),
          '400': response('Invalid request'),
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get the authenticated user',
        security: bearer,
        responses: {
          '200': response('Current user', {
            type: 'object',
            properties: { user: ref('SafeUser') },
          }),
          '401': response('Authentication required'),
        },
      },
    },
    '/api/v1/auth/admin-check': {
      get: {
        tags: ['Authentication'],
        summary: 'Check admin authorization',
        description: 'Requires ADMIN or SUPER_ADMIN role.',
        security: adminBearer,
        responses: {
          '200': response('Authorized', {
            type: 'object',
            properties: { authorized: { type: 'boolean', example: true } },
          }),
          '401': response('Authentication required'),
          '403': response('Admin role required'),
        },
      },
    },
    '/api/v1/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Get own profile',
        security: bearer,
        responses: {
          '200': response('Private safe profile', ref('PrivateProfile')),
          '401': response('Authentication required'),
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update own profile',
        security: bearer,
        requestBody: json(ref('ProfileUpdateRequest')),
        responses: {
          '200': response('Updated profile', ref('PrivateProfile')),
          '400': response('Invalid or unsafe profile fields'),
          '401': response('Authentication required'),
        },
      },
    },
    '/api/v1/users/{username}': {
      get: {
        tags: ['Users'],
        summary: 'Get a public profile',
        parameters: [{ $ref: '#/components/parameters/Username' }],
        responses: {
          '200': response('Public profile', ref('PublicProfile')),
          '404': response('User not found'),
        },
      },
    },
    '/api/v1/questions': {
      get: {
        tags: ['Questions'],
        summary: 'List published questions',
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
          {
            name: 'category',
            in: 'query',
            schema: { type: 'string', example: 'OLD_TESTAMENT' },
          },
          {
            name: 'difficulty',
            in: 'query',
            schema: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] },
          },
          {
            name: 'type',
            in: 'query',
            schema: { type: 'string', enum: ['MULTIPLE_CHOICE'] },
          },
        ],
        responses: {
          '200': response('Paginated published questions', ref('QuestionPage')),
          '400': response('Invalid filters'),
        },
      },
    },
    '/api/v1/questions/{id}': {
      get: {
        tags: ['Questions'],
        summary: 'Get a published question',
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': response('Public question', ref('PublicQuestion')),
          '404': response('Question not found'),
        },
      },
    },
    '/api/v1/games': {
      post: {
        tags: ['Games'],
        summary: 'Start a solo game',
        security: bearer,
        requestBody: json(ref('CreateGameRequest')),
        responses: {
          '201': response('Created game', ref('GameView')),
          '400': response('Only SOLO games with 20 questions are supported'),
          '401': response('Authentication required'),
          '409': response('Not enough eligible questions'),
        },
      },
    },
    '/api/v1/games/{gameId}': {
      get: {
        tags: ['Games'],
        summary: 'Get game state',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/GameId' }],
        responses: {
          '200': response('Game state', ref('GameView')),
          '401': response('Authentication required'),
          '404': response('Game not found'),
        },
      },
    },
    '/api/v1/games/{gameId}/answers': {
      post: {
        tags: ['Games'],
        summary: 'Submit the current answer',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/GameId' }],
        requestBody: json(ref('SubmitAnswerRequest')),
        responses: {
          '200': response('Authoritative answer result', ref('AnswerResponse')),
          '400': response('Invalid request'),
          '401': response('Authentication required'),
          '404': response('Game or option not found'),
          '409': response(
            'Wrong question, duplicate answer, or completed game',
          ),
        },
      },
    },
    '/api/v1/games/{gameId}/complete': {
      post: {
        tags: ['Games'],
        summary: 'Complete an in-progress game',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/GameId' }],
        responses: {
          '200': response('Game result', ref('GameResult')),
          '401': response('Authentication required'),
          '404': response('Game not found'),
          '409': response('Game is already complete'),
        },
      },
    },
    '/api/v1/games/{gameId}/results': {
      get: {
        tags: ['Games'],
        summary: 'Get game results',
        security: bearer,
        parameters: [{ $ref: '#/components/parameters/GameId' }],
        responses: {
          '200': response('Game result', ref('GameResult')),
          '401': response('Authentication required'),
          '404': response('Results not found'),
        },
      },
    },
    '/api/v1/leaderboard': {
      get: {
        tags: ['Leaderboard'],
        summary: 'List global or weekly rankings',
        parameters: [
          {
            name: 'scope',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['global', 'weekly'],
              default: 'global',
            },
          },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
        ],
        responses: {
          '200': response('Paginated leaderboard', ref('LeaderboardPage')),
          '400': response('Invalid scope or pagination'),
        },
      },
    },
    '/api/v1/leaderboard/me': {
      get: {
        tags: ['Leaderboard'],
        summary: 'Get current user rank',
        security: bearer,
        parameters: [
          {
            name: 'scope',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['global', 'weekly'],
              default: 'global',
            },
          },
        ],
        responses: {
          '200': response('Current rank', ref('MyRank')),
          '401': response('Authentication required'),
        },
      },
    },
    '/api/v1/suggestions': {
      post: {
        tags: ['Suggestions'],
        summary: 'Submit a suggestion',
        security: bearer,
        requestBody: json(ref('SuggestionCreateRequest')),
        responses: {
          '201': response('Created pending suggestion', ref('Suggestion')),
          '400': response('Invalid suggestion'),
          '401': response('Authentication required'),
        },
      },
    },
    '/api/v1/suggestions/me': {
      get: {
        tags: ['Suggestions'],
        summary: 'List own suggestions',
        security: bearer,
        responses: {
          '200': response('Own suggestions', {
            type: 'array',
            items: ref('Suggestion'),
          }),
          '401': response('Authentication required'),
        },
      },
    },
    '/api/v1/admin/dashboard': {
      get: {
        tags: ['Admin'],
        summary: 'Get dashboard metrics',
        description: 'Requires ADMIN or SUPER_ADMIN.',
        security: adminBearer,
        responses: {
          '200': response('Dashboard metrics', ref('DashboardMetrics')),
          '401': response('Authentication required'),
          '403': response('Admin role required'),
        },
      },
    },
    '/api/v1/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List users',
        security: adminBearer,
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['ACTIVE', 'SUSPENDED', 'DISABLED'],
            },
          },
        ],
        responses: {
          '200': response('Paginated users', ref('UserPage')),
          '400': response('Invalid filters'),
          '403': response('Admin role required'),
        },
      },
    },
    '/api/v1/admin/users/{id}': {
      get: {
        tags: ['Admin'],
        summary: 'Get user details',
        security: adminBearer,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': response('Safe user details', ref('AdminUser')),
          '403': response('Admin role required'),
          '404': response('User not found'),
        },
      },
    },
    '/api/v1/admin/users/{id}/status': {
      patch: {
        tags: ['Admin'],
        summary: 'Change user status',
        security: adminBearer,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        requestBody: json({
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['ACTIVE', 'SUSPENDED', 'DISABLED'],
            },
          },
        }),
        responses: {
          '200': response('Updated user', ref('AdminUser')),
          '400': response('Invalid status'),
          '403': response('Admin role required'),
          '404': response('User not found'),
        },
      },
    },
    '/api/v1/admin/questions': {
      post: {
        tags: ['Admin'],
        summary: 'Create a question',
        security: adminBearer,
        requestBody: json(ref('AdminQuestionRequest')),
        responses: {
          '201': response(
            'Created question including answer key',
            ref('AdminQuestion'),
          ),
          '400': response('Invalid question or options'),
          '403': response('Admin role required'),
          '404': response('Category not found'),
        },
      },
    },
    '/api/v1/admin/questions/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Update a question',
        security: adminBearer,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        requestBody: json(ref('AdminQuestionPatch')),
        responses: {
          '200': response('Updated question', ref('AdminQuestion')),
          '400': response('Invalid question'),
          '403': response('Admin role required'),
          '404': response('Question or category not found'),
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Archive a question',
        security: adminBearer,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': response('Archived question', ref('AdminQuestion')),
          '403': response('Admin role required'),
          '404': response('Question not found'),
        },
      },
    },
    '/api/v1/admin/questions/{id}/publish': {
      patch: {
        tags: ['Admin'],
        summary: 'Publish or unpublish a question',
        security: adminBearer,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        requestBody: json({
          type: 'object',
          required: ['published'],
          properties: { published: { type: 'boolean' } },
        }),
        responses: {
          '200': response('Updated question', ref('AdminQuestion')),
          '400': response('Invalid request'),
          '403': response('Admin role required'),
          '409': response('Archived questions cannot be published'),
          '404': response('Question not found'),
        },
      },
    },
    '/api/v1/admin/suggestions': {
      get: {
        tags: ['Admin'],
        summary: 'List all suggestions',
        security: adminBearer,
        responses: {
          '200': response('Suggestions for review', {
            type: 'array',
            items: ref('AdminSuggestion'),
          }),
          '403': response('Admin role required'),
        },
      },
    },
    '/api/v1/admin/suggestions/{id}': {
      get: {
        tags: ['Admin'],
        summary: 'Get a suggestion for review',
        security: adminBearer,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        responses: {
          '200': response('Suggestion details', ref('AdminSuggestion')),
          '403': response('Admin role required'),
          '404': response('Suggestion not found'),
        },
      },
      patch: {
        tags: ['Admin'],
        summary: 'Review a suggestion',
        security: adminBearer,
        parameters: [{ $ref: '#/components/parameters/Id' }],
        requestBody: json(ref('AdminSuggestionPatch')),
        responses: {
          '200': response('Reviewed suggestion', ref('AdminSuggestion')),
          '400': response('Invalid review'),
          '403': response('Admin role required'),
          '404': response('Suggestion not found'),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Short-lived access token from login or refresh.',
      },
    },
    parameters: {
      Id: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
      GameId: {
        name: 'gameId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
      Username: {
        name: 'username',
        in: 'path',
        required: true,
        schema: { type: 'string', example: 'wesley' },
      },
      Page: {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, default: 1 },
      },
      Limit: {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'REQUEST_ERROR' },
              message: { type: 'string' },
              requestId: { type: 'string' },
            },
            required: ['code', 'message', 'requestId'],
          },
        },
        required: ['error'],
      },
      RegisterRequest: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          username: {
            type: 'string',
            minLength: 3,
            maxLength: 32,
            example: 'wesley',
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com',
          },
          password: {
            type: 'string',
            format: 'password',
            minLength: 8,
            example: 'strong-password',
          },
        },
        additionalProperties: false,
      },
      LoginRequest: {
        type: 'object',
        required: ['password'],
        properties: {
          identifier: { type: 'string', example: 'wesley' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' },
        },
        additionalProperties: false,
      },
      RefreshRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } },
        additionalProperties: false,
      },
      SafeUser: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['USER', 'ADMIN', 'SUPER_ADMIN'] },
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'DISABLED'] },
        },
        required: ['id', 'username', 'email', 'role', 'status'],
      },
      AuthResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          user: ref('SafeUser'),
        },
        required: ['accessToken', 'refreshToken', 'user'],
      },
      ProfileUpdateRequest: {
        type: 'object',
        properties: {
          displayName: { type: 'string', nullable: true, maxLength: 100 },
          avatarUrl: { type: 'string', format: 'uri', nullable: true },
          bio: { type: 'string', nullable: true, maxLength: 500 },
        },
        additionalProperties: false,
      },
      PrivateProfile: {
        allOf: [
          { $ref: '#/components/schemas/SafeUser' },
          {
            type: 'object',
            properties: { profile: { $ref: '#/components/schemas/Profile' } },
          },
        ],
      },
      Profile: {
        type: 'object',
        properties: {
          displayName: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', nullable: true },
          bio: { type: 'string', nullable: true },
        },
      },
      PublicProfile: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          profile: ref('Profile'),
          gamesPlayed: { type: 'integer' },
          totalScore: { type: 'integer' },
          accuracy: { type: 'number', format: 'float' },
        },
        required: ['username', 'gamesPlayed', 'totalScore', 'accuracy'],
      },
      PublicOption: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          order: { type: 'integer' },
        },
        required: ['id', 'text', 'order'],
      },
      Scripture: {
        type: 'object',
        nullable: true,
        properties: {
          book: { type: 'string' },
          chapter: { type: 'integer' },
          verse: { type: 'integer' },
          verseEnd: { type: 'integer', nullable: true },
          translation: { type: 'string', nullable: true },
        },
      },
      PublicQuestion: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          type: { type: 'string', enum: ['MULTIPLE_CHOICE'] },
          difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] },
          options: {
            type: 'array',
            minItems: 4,
            maxItems: 4,
            items: ref('PublicOption'),
          },
          scripture: ref('Scripture'),
        },
        required: ['id', 'text', 'type', 'difficulty', 'options', 'scripture'],
      },
      QuestionPage: {
        type: 'object',
        properties: {
          data: { type: 'array', items: ref('PublicQuestion') },
          pagination: ref('Pagination'),
        },
        required: ['data', 'pagination'],
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
        required: ['page', 'limit', 'total', 'totalPages'],
      },
      CreateGameRequest: {
        type: 'object',
        required: ['gameType', 'questionCount'],
        properties: {
          gameType: { type: 'string', enum: ['SOLO'], example: 'SOLO' },
          questionCount: { type: 'integer', enum: [20], example: 20 },
        },
        additionalProperties: false,
      },
      SubmitAnswerRequest: {
        type: 'object',
        required: ['questionId', 'selectedOptionId', 'responseTimeMs'],
        properties: {
          questionId: { type: 'string' },
          selectedOptionId: { type: 'string' },
          responseTimeMs: { type: 'integer', minimum: 0, maximum: 600000 },
        },
        additionalProperties: false,
      },
      GameView: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: {
            type: 'string',
            enum: ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'],
          },
          questionCount: { type: 'integer' },
          currentQuestion: { type: 'integer' },
          totalQuestions: { type: 'integer' },
          progress: { type: 'number' },
          score: { type: 'integer' },
          currentStreak: { type: 'integer' },
          longestStreak: { type: 'integer' },
          currentQuestionData: {
            allOf: [{ $ref: '#/components/schemas/PublicQuestion' }],
            nullable: true,
          },
        },
      },
      Scoring: {
        type: 'object',
        properties: {
          basePoints: { type: 'integer' },
          speedBonus: { type: 'integer' },
          streakBonus: { type: 'integer' },
          difficultyMultiplier: { type: 'number' },
          totalPoints: { type: 'integer' },
        },
      },
      AnswerResponse: {
        type: 'object',
        properties: {
          correct: { type: 'boolean' },
          selectedAnswer: ref('PublicOption'),
          explanation: { type: 'string' },
          scripture: ref('Scripture'),
          pointsEarned: { type: 'integer' },
          scoring: ref('Scoring'),
          currentScore: { type: 'integer' },
          currentStreak: { type: 'integer' },
          completed: { type: 'boolean' },
          questionNumber: { type: 'integer' },
          nextQuestionNumber: { type: 'integer', nullable: true },
          nextQuestion: {
            allOf: [{ $ref: '#/components/schemas/PublicQuestion' }],
            nullable: true,
          },
        },
      },
      GameResult: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          gameId: { type: 'string' },
          totalScore: { type: 'integer' },
          correctAnswers: { type: 'integer' },
          incorrectAnswers: { type: 'integer' },
          accuracy: { type: 'number' },
          longestStreak: { type: 'integer' },
          completedAt: { type: 'string', format: 'date-time' },
        },
      },
      LeaderboardEntry: {
        type: 'object',
        properties: {
          rank: { type: 'integer' },
          username: { type: 'string' },
          score: { type: 'integer' },
          gamesPlayed: { type: 'integer' },
          accuracy: { type: 'number' },
        },
        required: ['rank', 'username', 'score', 'gamesPlayed', 'accuracy'],
      },
      LeaderboardPage: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['global', 'weekly'] },
          data: { type: 'array', items: ref('LeaderboardEntry') },
          pagination: ref('Pagination'),
        },
      },
      MyRank: {
        type: 'object',
        properties: {
          scope: { type: 'string' },
          rank: { type: 'integer', nullable: true },
          entry: {
            allOf: [{ $ref: '#/components/schemas/LeaderboardEntry' }],
            nullable: true,
          },
        },
      },
      SuggestionCreateRequest: {
        type: 'object',
        required: ['type', 'title', 'description'],
        properties: {
          type: {
            type: 'string',
            enum: [
              'QUESTION',
              'QUESTION_CORRECTION',
              'FEATURE',
              'BUG_REPORT',
              'GENERAL',
            ],
          },
          title: { type: 'string' },
          description: { type: 'string' },
          suggestedQuestion: { type: 'string' },
          suggestedOptions: {
            type: 'array',
            minItems: 4,
            maxItems: 4,
            items: { type: 'string' },
          },
          suggestedCorrectOption: { type: 'string' },
          suggestedScriptureReference: {
            oneOf: [
              { type: 'string' },
              { $ref: '#/components/schemas/Scripture' },
            ],
          },
        },
        additionalProperties: false,
      },
      Suggestion: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: {
            type: 'string',
            enum: [
              'PENDING',
              'UNDER_REVIEW',
              'APPROVED',
              'REJECTED',
              'RESOLVED',
            ],
          },
          suggestedQuestion: { type: 'string', nullable: true },
          suggestedOptions: {
            type: 'array',
            nullable: true,
            items: { type: 'string' },
          },
          suggestedCorrectOption: { type: 'string', nullable: true },
          suggestedScriptureReference: { nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      DashboardMetrics: {
        type: 'object',
        properties: {
          totalUsers: { type: 'integer' },
          activeUsers: { type: 'integer' },
          suspendedUsers: { type: 'integer' },
          disabledUsers: { type: 'integer' },
          totalGames: { type: 'integer' },
          completedGames: { type: 'integer' },
          totalQuestions: { type: 'integer' },
          publishedQuestions: { type: 'integer' },
          pendingSuggestions: { type: 'integer' },
          totalAnswers: { type: 'integer' },
          correctAnswers: { type: 'integer' },
        },
      },
      AdminUser: {
        allOf: [
          { $ref: '#/components/schemas/SafeUser' },
          {
            type: 'object',
            properties: {
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              lastLoginAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
            },
          },
        ],
      },
      UserPage: {
        type: 'object',
        properties: {
          data: { type: 'array', items: ref('AdminUser') },
          pagination: ref('Pagination'),
        },
      },
      AdminQuestionRequest: {
        type: 'object',
        required: [
          'text',
          'difficulty',
          'categoryId',
          'explanation',
          'options',
          'scripture',
        ],
        properties: {
          text: { type: 'string' },
          type: { type: 'string', enum: ['MULTIPLE_CHOICE'] },
          difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] },
          categoryId: { type: 'string' },
          explanation: { type: 'string' },
          published: { type: 'boolean' },
          options: {
            type: 'array',
            minItems: 4,
            maxItems: 4,
            items: {
              type: 'object',
              required: ['text', 'order', 'isCorrect'],
              properties: {
                text: { type: 'string' },
                order: { type: 'integer', minimum: 1, maximum: 4 },
                isCorrect: { type: 'boolean' },
              },
            },
          },
          scripture: { $ref: '#/components/schemas/Scripture' },
        },
        additionalProperties: false,
      },
      AdminQuestionPatch: {
        type: 'object',
        description: 'Partial update of question fields.',
        properties: {
          text: { type: 'string' },
          type: { type: 'string', enum: ['MULTIPLE_CHOICE'] },
          difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] },
          categoryId: { type: 'string' },
          explanation: { type: 'string' },
          published: { type: 'boolean' },
          options: {
            type: 'array',
            minItems: 4,
            maxItems: 4,
            items: {
              type: 'object',
              required: ['text', 'order', 'isCorrect'],
              properties: {
                text: { type: 'string' },
                order: { type: 'integer', minimum: 1, maximum: 4 },
                isCorrect: { type: 'boolean' },
              },
            },
          },
          scripture: {
            allOf: [{ $ref: '#/components/schemas/Scripture' }],
            nullable: true,
          },
        },
        additionalProperties: false,
      },
      AdminQuestion: {
        allOf: [
          { $ref: '#/components/schemas/PublicQuestion' },
          {
            type: 'object',
            properties: {
              explanation: { type: 'string' },
              published: { type: 'boolean' },
              archived: { type: 'boolean' },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    text: { type: 'string' },
                    order: { type: 'integer' },
                    isCorrect: { type: 'boolean' },
                  },
                },
              },
            },
          },
        ],
      },
      AdminSuggestionPatch: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: [
              'PENDING',
              'UNDER_REVIEW',
              'APPROVED',
              'REJECTED',
              'RESOLVED',
            ],
          },
          adminNotes: { type: 'string', nullable: true },
        },
        additionalProperties: false,
      },
      AdminSuggestion: {
        allOf: [
          { $ref: '#/components/schemas/Suggestion' },
          {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              adminNotes: { type: 'string', nullable: true },
              reviewedById: { type: 'string', nullable: true },
              reviewedAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
              user: { type: 'object' },
              reviewedBy: { type: 'object', nullable: true },
            },
          },
        ],
      },
    },
  },
};
