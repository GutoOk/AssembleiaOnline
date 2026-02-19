'use client';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import {
  Assembly,
  AtaItem,
  Poll,
  Vote,
  UserProfile,
  PollOption,
} from '@/lib/data';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Firestore,
  collection,
  getDocs,
  query,
  where,
  documentId,
} from 'firebase/firestore';

// This function will fetch all necessary data
export async function downloadAta(
  firestore: Firestore,
  assembly: Assembly,
  timelineItems: (AtaItem | Poll)[]
) {
  // 1. Fetch all votes and options for all polls
  const allVotes: Record<string, Vote[]> = {};
  const allOptions: Record<string, PollOption[]> = {};
  const pollIds = timelineItems
    .filter((item) => 'question' in item)
    .map((p) => p.id);

  const userIdsInvolved = new Set<string>();

  for (const pollId of pollIds) {
    const votesQuery = query(
      collection(firestore, `assemblies/${assembly.id}/polls/${pollId}/votes`)
    );
    const optionsQuery = query(
      collection(firestore, `assemblies/${assembly.id}/polls/${pollId}/options`)
    );

    const [votesSnapshot, optionsSnapshot] = await Promise.all([
      getDocs(votesQuery),
      getDocs(optionsQuery),
    ]);

    const votes = votesSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Vote)
    );
    allVotes[pollId] = votes;
    votes.forEach((vote) => {
      userIdsInvolved.add(vote.userId); // The voter
      if (vote.representedUserId) {
        userIdsInvolved.add(vote.representedUserId); // The one being represented
      }
    });

    allOptions[pollId] = optionsSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as PollOption)
    );
  }

  // Also add admins who created AtaItems
   timelineItems.forEach(item => {
    if ('administratorId' in item) {
        userIdsInvolved.add(item.administratorId);
    }
  })

  // 2. Fetch all user profiles for the voters
  const userProfiles: Record<string, UserProfile> = {};
  const userIdArray = Array.from(userIdsInvolved);
  if (userIdArray.length > 0) {
    const userChunks: string[][] = [];
    for (let i = 0; i < userIdArray.length; i += 30) {
      userChunks.push(userIdArray.slice(i, i + 30));
    }
    for (const chunk of userChunks) {
      if (chunk.length === 0) continue;
      const usersQuery = query(
        collection(firestore, 'users'),
        where(documentId(), 'in', chunk)
      );
      const usersSnapshot = await getDocs(usersQuery);
      usersSnapshot.forEach((doc) => {
        userProfiles[doc.id] = { id: doc.id, ...doc.data() } as UserProfile;
      });
    }
  }

  // 3. Generate and download the document
  await generateDocx(assembly, timelineItems, allVotes, allOptions, userProfiles);
}

// This function generates the docx
async function generateDocx(
  assembly: Assembly,
  timelineItems: (AtaItem | Poll)[],
  allVotes: Record<string, Vote[]>,
  allOptions: Record<string, PollOption[]>,
  userProfiles: Record<string, UserProfile>
) {
  const formatTime = (date: Date) => format(date, "HH:mm'h'", { locale: ptBR });
  const formatDateTime = (date: Date) =>
    format(date, "dd 'de' MMMM de yyyy, 'às' HH:mm'h'", { locale: ptBR });

  const children: any[] = [];

  // Header
  children.push(
    new Paragraph({
      text: 'ATA DA ASSEMBLEIA GERAL',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    })
  );
  children.push(
    new Paragraph({
      text: assembly.title.toUpperCase(),
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    })
  );
  children.push(new Paragraph({})); // Spacer

  // Basic Info
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Data Agendada: ', bold: true }),
        new TextRun(formatDateTime(assembly.date.toDate())),
      ],
    })
  );

  if (assembly.location) {
    const locationString = `${assembly.location.address}, ${assembly.location.city} - ${assembly.location.state}`;
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Local: ', bold: true }),
          new TextRun(locationString),
        ],
      })
    );
  }

  if (assembly.startedAt) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Início Real: ', bold: true }),
          new TextRun(formatDateTime(assembly.startedAt.toDate())),
        ],
      })
    );
  }
  children.push(new Paragraph({})); // Spacer
  children.push(
    new Paragraph({
      text: 'DELIBERAÇÕES',
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
    })
  );

  // Timeline Items (chronological order)
  const sortedTimeline = [...timelineItems].sort((a, b) => {
    const dateA = a.createdAt?.toDate() ?? new Date(0);
    const dateB = b.createdAt?.toDate() ?? new Date(0);
    return dateA.getTime() - dateB.getTime();
  });

  for (const item of sortedTimeline) {
    children.push(new Paragraph({})); // Spacer

    if ('question' in item) {
      // It's a Poll
      const poll = item as Poll;
      const votes = allVotes[poll.id] || [];
      const options = allOptions[poll.id] || [];
      const optionMap = new Map(options.map((o) => [o.id, o.text]));

      children.push(
        new Paragraph({
          text: `VOTAÇÃO: ${poll.question}`,
          heading: HeadingLevel.HEADING_3,
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Iniciada em: ', bold: true }),
            new TextRun(formatTime(poll.createdAt.toDate())),
            new TextRun(' / '),
            new TextRun({ text: 'Encerrada em: ', bold: true }),
            new TextRun(formatTime(poll.endDate.toDate())),
          ],
        })
      );

      // Votes Table
      const voterList = votes
        .map((vote) => {
          const personRepresented = userProfiles[vote.representedUserId || ''];
          const voter = userProfiles[vote.userId];
          const optionText = optionMap.get(vote.pollOptionId) || 'Voto inválido';
          return {
            name: personRepresented?.name || voter?.name || 'Usuário não encontrado',
            email: personRepresented?.email || voter?.email || 'Email não encontrado',
            vote: optionText,
            proxy: vote.representedUserId ? voter?.name : undefined,
          };
        })
        .sort((a, b) => a.email.localeCompare(b.email));

      const tableRows = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              children: [new Paragraph({ text: 'NOME', bold: true })],
            }),
            new TableCell({
              children: [new Paragraph({ text: 'EMAIL', bold: true })],
            }),
            new TableCell({
              children: [new Paragraph({ text: 'VOTO', bold: true })],
            }),
            new TableCell({
              children: [
                new Paragraph({ text: 'POR PROCURAÇÃO A', bold: true }),
              ],
            }),
          ],
        }),
        ...voterList.map(
          (voter) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(voter.name)] }),
                new TableCell({ children: [new Paragraph(voter.email)] }),
                new TableCell({ children: [new Paragraph(voter.vote)] }),
                new TableCell({ children: [new Paragraph(voter.proxy || '')] }),
              ],
            })
        ),
      ];

      const table = new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      });
      children.push(table);
    } else {
      // It's an AtaItem
      const ata = item as AtaItem;
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[${formatTime(ata.createdAt.toDate())}] `,
              bold: true,
            }),
            new TextRun(ata.text),
          ],
        })
      );
    }
  }

  // Footer
  children.push(new Paragraph({}));
  if (assembly.endedAt) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Encerramento: ', bold: true }),
          new TextRun(formatDateTime(assembly.endedAt.toDate())),
        ],
      })
    );
  }
  children.push(new Paragraph({}));
  children.push(
    new Paragraph({
      text: 'A presente ata foi lavrada e segue para registro.',
      alignment: AlignmentType.CENTER,
    })
  );

  // Generate document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children,
      },
    ],
  });

  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, `Ata - ${assembly.title}.docx`);
  });
}
