import { PlaceHolderImages } from './placeholder-images';

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: 'admin' | 'member';
};

export type PollOption = {
  id: string;
  text: string;
};

export type Vote = {
  userId: string;
  optionId: string;
};

export type Poll = {
  id:string;
  question: string;
  options: PollOption[];
  votes: Vote[];
  endDate: Date;
};

export type Speaker = {
  userId: string;
  status: 'waiting' | 'next' | 'speaking';
  joinedAt: Date;
  zoomLink?: string;
};

export type Assembly = {
  id: string;
  title: string;
  description: string;
  date: Date;
  youtubeUrl: string;
  imageUrl: string;
  status: 'scheduled' | 'live' | 'finished';
  polls: Poll[];
  speakingQueue: Speaker[];
};

const users: User[] = [
  { id: '1', name: 'Admin Silva', email: 'admin@mensa.org.br', avatarUrl: PlaceHolderImages.find(p => p.id === 'user-avatar-1')?.imageUrl ?? '', role: 'admin' },
  { id: '2', name: 'Membro Batista', email: 'membro1@mensa.org.br', avatarUrl: PlaceHolderImages.find(p => p.id === 'user-avatar-2')?.imageUrl ?? '', role: 'member' },
  { id: '3', name: 'Membro Costa', email: 'membro2@mensa.org.br', avatarUrl: PlaceHolderImages.find(p => p.id === 'user-avatar-3')?.imageUrl ?? '', role: 'member' },
  { id: '4', name: 'Membro Oliveira', email: 'membro3@mensa.org.br', avatarUrl: PlaceHolderImages.find(p => p.id === 'user-avatar-4')?.imageUrl ?? '', role: 'member' },
  { id: '5', name: 'Membro Pereira', email: 'membro4@mensa.org.br', avatarUrl: PlaceHolderImages.find(p => p.id === 'user-avatar-5')?.imageUrl ?? '', role: 'member' },
];

const assemblies: Assembly[] = [
  {
    id: '1',
    title: 'Assembleia Geral Ordinária 2024',
    description: 'Discussão e votação sobre as novas diretrizes anuais da Mensa Brasil, incluindo planejamento estratégico e orçamento.',
    date: new Date('2024-08-15T14:00:00'),
    youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    imageUrl: PlaceHolderImages.find(p => p.id === 'assembly-card-1')?.imageUrl ?? '',
    status: 'live',
    polls: [
      {
        id: 'p1',
        question: 'Você aprova o orçamento proposto para o próximo ano fiscal?',
        options: [{id: 'o1', text: 'Sim'}, {id: 'o2', text: 'Não'}, {id: 'o3', text: 'Abstenção'}],
        votes: [
          {userId: '2', optionId: 'o1'},
          {userId: '3', optionId: 'o1'},
          {userId: '4', optionId: 'o2'},
        ],
        endDate: new Date(Date.now() + 1000 * 60 * 5) // Ends in 5 minutes
      }
    ],
    speakingQueue: [
      { userId: '3', status: 'speaking', joinedAt: new Date(Date.now() - 1000 * 60 * 10), zoomLink: 'https://zoom.us/j/1234567890' },
      { userId: '4', status: 'next', joinedAt: new Date(Date.now() - 1000 * 60 * 8) },
      { userId: '5', status: 'waiting', joinedAt: new Date(Date.now() - 1000 * 60 * 5) },
    ]
  },
  {
    id: '2',
    title: 'Assembleia Extraordinária - Reforma do Estatuto',
    description: 'Análise e deliberação sobre as propostas de alteração do estatuto da associação.',
    date: new Date('2024-09-01T10:00:00'),
    youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    imageUrl: PlaceHolderImages.find(p => p.id === 'assembly-card-2')?.imageUrl ?? '',
    status: 'scheduled',
    polls: [],
    speakingQueue: [],
  },
  {
    id: '3',
    title: 'Assembleia de Encerramento do Ano',
    description: 'Apresentação dos resultados anuais e confraternização.',
    date: new Date('2023-12-20T18:00:00'),
    youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    imageUrl: PlaceHolderImages.find(p => p.id === 'assembly-card-3')?.imageUrl ?? '',
    status: 'finished',
    polls: [],
    speakingQueue: [],
  },
];

export const MOCK_DATA = {
    users,
    assemblies,
}
