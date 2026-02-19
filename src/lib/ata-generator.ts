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
import jsPDF from 'jspdf';
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
  timelineItems: (AtaItem | Poll)[],
  isAdmin: boolean
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

  // 3. Generate and download the document based on user role
  if (isAdmin) {
    await generateDocx(assembly, timelineItems, allVotes, allOptions, userProfiles);
  } else {
    await generatePdf(assembly, timelineItems, allVotes, allOptions, userProfiles);
  }
}

// This function generates the PDF using jsPDF's native methods for a smaller, text-based file
async function generatePdf(
  assembly: Assembly,
  timelineItems: (AtaItem | Poll)[],
  allVotes: Record<string, Vote[]>,
  allOptions: Record<string, PollOption[]>,
  userProfiles: Record<string, UserProfile>
) {
  const doc = new jsPDF('p', 'pt', 'a4');
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageBreak = (neededHeight = 20) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const printWrappedText = (text: string, x: number, currentY: number, maxWidth: number, options: { fontSize?: number, fontStyle?: string } = {}) => {
      const fontSize = options.fontSize || 10;
      const fontStyle = options.fontStyle || 'normal';
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      const lines = doc.splitTextToSize(text, maxWidth);
      
      checkPageBreak(lines.length * fontSize);

      doc.text(lines, x, currentY);
      return currentY + lines.length * (doc.getLineHeight() / doc.internal.scaleFactor) * 0.8;
  };
  
  const formatTime = (date: Date) => format(date, "HH:mm'h'", { locale: ptBR });
  const formatDateTime = (date: Date) => format(date, "dd 'de' MMMM de yyyy, 'às' HH:mm'h'", { locale: ptBR });
  
  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ATA DA ASSEMBLEIA GERAL', pageWidth / 2, y, { align: 'center' });
  y += 25;

  doc.setFontSize(14);
  doc.text(assembly.title.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 30;

  // Assembly Info
  y = printWrappedText(`Data Agendada: ${formatDateTime(assembly.date.toDate())}`, margin, y, contentWidth, { fontSize: 10 });
  y += 5;

  if (assembly.location) {
    const locationString = `${assembly.location.address}, ${assembly.location.city} - ${assembly.location.state}`;
    y = printWrappedText(`Local: ${locationString}`, margin, y, contentWidth, { fontSize: 10 });
    y += 5;
  }
  if (assembly.startedAt) {
    y = printWrappedText(`Início Real: ${formatDateTime(assembly.startedAt.toDate())}`, margin, y, contentWidth, { fontSize: 10 });
  }
  y += 20;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DELIBERAÇÕES', pageWidth / 2, y, { align: 'center' });
  y += 25;

  // Timeline Items
  const sortedTimeline = [...timelineItems].sort((a, b) => {
    const dateA = a.createdAt?.toDate() ?? new Date(0);
    const dateB = b.createdAt?.toDate() ?? new Date(0);
    return dateA.getTime() - dateB.getTime();
  });

  for (const item of sortedTimeline) {
      checkPageBreak(40);
      y += 20;

      if ('question' in item) {
          const poll = item as Poll;
          const votes = allVotes[poll.id] || [];
          const options = allOptions[poll.id] || [];
          const optionMap = new Map(options.map((o) => [o.id, o.text]));
          
          y = printWrappedText(`VOTAÇÃO: ${poll.question}`, margin, y, contentWidth, { fontSize: 12, fontStyle: 'bold' });
          y += 5;

          y = printWrappedText(`Iniciada em: ${formatTime(poll.createdAt.toDate())} / Encerrada em: ${formatTime(poll.endDate.toDate())}`, margin, y, contentWidth, { fontSize: 9 });
          y += 15;
          
          const head = [['NOME', 'EMAIL', 'VOTO', 'POR PROCURAÇÃO A']];
          const body = votes.map((vote) => {
            const personRepresented = userProfiles[vote.representedUserId || ''];
            const voter = userProfiles[vote.userId];
            const optionText = optionMap.get(vote.pollOptionId) || 'Voto inválido';
            return [
              personRepresented?.name || voter?.name || 'Usuário não encontrado',
              personRepresented?.email || voter?.email || 'Email não encontrado',
              optionText,
              vote.representedUserId ? (voter?.name || '') : '',
            ];
          }).sort((a, b) => a[1].localeCompare(b[1]));

          const tableColumnWidths = [150, 160, 70, 150];
          const tableCellPadding = 5;
          const lineHeight = 12;

          // Header
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          checkPageBreak(lineHeight + tableCellPadding * 2);
          let currentX = margin;
          head[0].forEach((cell, i) => {
              doc.text(cell, currentX + tableCellPadding, y + lineHeight);
              currentX += tableColumnWidths[i];
          });
          y += lineHeight + tableCellPadding;
          doc.line(margin, y, pageWidth - margin, y);
          y += tableCellPadding;

          // Body
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          body.forEach(row => {
              let maxLines = 0;
              const rowLines: string[][] = [];

              row.forEach((cell, i) => {
                  const lines = doc.splitTextToSize(cell, tableColumnWidths[i] - tableCellPadding * 2);
                  rowLines.push(lines);
                  if (lines.length > maxLines) {
                      maxLines = lines.length;
                  }
              });
              
              const rowHeight = maxLines * (lineHeight * 0.8) + tableCellPadding * 2;
              checkPageBreak(rowHeight);

              const startY = y;
              currentX = margin;
              rowLines.forEach((lines, i) => {
                  doc.text(lines, currentX + tableCellPadding, startY + lineHeight * 0.8);
                  currentX += tableColumnWidths[i];
              });

              y += rowHeight;
              doc.line(margin, y - tableCellPadding, pageWidth - margin, y - tableCellPadding);
          });
          y += 10;
      } else {
          const ata = item as AtaItem;
          const timeText = `[${formatTime(ata.createdAt.toDate())}] `;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          const timeWidth = doc.getTextWidth(timeText);
          
          const textLines = doc.splitTextToSize(ata.text, contentWidth - timeWidth);
          const neededHeight = textLines.length * (doc.getLineHeight() / doc.internal.scaleFactor);
          checkPageBreak(neededHeight);

          doc.text(timeText, margin, y);
          
          doc.setFont('helvetica', 'normal');
          y = printWrappedText(ata.text, margin + timeWidth, y, contentWidth - timeWidth, { fontSize: 10 });
      }
  }

  // Footer
  checkPageBreak(40);
  y += 20;
  if (assembly.endedAt) {
      y = printWrappedText(`Encerramento: ${formatDateTime(assembly.endedAt.toDate())}`, margin, y, contentWidth, { fontSize: 10 });
  }
  y += 30;

  checkPageBreak(20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('A presente ata foi lavrada e segue para registro.', pageWidth / 2, y, { align: 'center' });

  doc.save(`Ata - ${assembly.title}.pdf`);
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
