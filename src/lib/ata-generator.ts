'use client';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
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


const DISCLAIMER_TEXT =
  'Este documento é uma cópia preliminar gerada pelo sistema para simples conferência e não possui valor legal. Os registros apresentados são informativos e refletem dados brutos, não substituindo a ata oficial, que será publicada na pasta de documentos do Google Drive para conferência e eventuais pedidos de retificação. A ata definitiva somente estará consolidada após a aprovação do texto oficial na próxima assembleia.';


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

function getPollResult(poll: Poll, options: PollOption[], votes: Vote[]) {
    if (poll.type !== 'proposal' || poll.status === 'open' || poll.status === 'draft') {
        return null;
    }
    if (poll.status === 'annulled') {
        return { status: 'Anulada', message: poll.annulmentReason || 'Votação foi anulada.' };
    }

    const favorOption = options.find(o => o.text.trim().toLowerCase() === 'a favor');
    const contraOption = options.find(o => o.text.trim().toLowerCase() === 'contra');
    const abstencaoOption = options.find(o => o.text.trim().toLowerCase() === 'abstenção');


    if (!favorOption || !contraOption) {
      return { status: 'Indeterminado', message: 'Não é uma votação de proposta padrão (A favor/Contra).' };
    }

    const favorVotes = votes.filter(v => v.pollOptionId === favorOption.id).length;
    const contraVotes = votes.filter(v => v.pollOptionId === contraOption.id).length;
    const abstencaoVotes = abstencaoOption ? votes.filter(v => v.pollOptionId === abstencaoOption.id).length : 0;

    let isApproved = false;
    let quorumMessage = '';

    const quorumTypeMap = {
        simple_majority: 'Maioria Simples',
        absolute_majority: 'Maioria Absoluta',
        two_thirds_majority: '2/3 dos Votantes'
    };
    const quorumText = poll.quorumType ? quorumTypeMap[poll.quorumType] : '';

    switch (poll.quorumType) {
        case 'simple_majority':
            isApproved = favorVotes > (contraVotes + abstencaoVotes);
            quorumMessage = `${quorumText}: ${favorVotes} (A favor) vs ${contraVotes + abstencaoVotes} (Contra + Abstenções).`;
            break;
        
        case 'absolute_majority':
            if (!poll.totalActiveMembers || poll.totalActiveMembers === 0) {
                return { status: 'Indeterminado', message: 'Número total de membros ativos não definido para cálculo de maioria absoluta.' };
            }
            const requiredVotes = Math.floor(poll.totalActiveMembers / 2) + 1;
            isApproved = favorVotes >= requiredVotes;
            quorumMessage = `${quorumText}: ${favorVotes} votos de ${requiredVotes} necessários (baseado em ${poll.totalActiveMembers} membros).`;
            break;

        case 'two_thirds_majority':
            const totalVotes = favorVotes + contraVotes + abstencaoVotes;
            if (totalVotes === 0) {
                isApproved = false;
                quorumMessage = 'Quórum de 2/3: Nenhum voto registrado.'
            } else {
                isApproved = favorVotes > ( (2/3) * totalVotes );
                quorumMessage = `${quorumText}: ${favorVotes} votos a favor de um total de ${totalVotes} votantes.`;
            }
            break;
        
        default:
            return { status: 'Indeterminado', message: 'Tipo de quórum não reconhecido.' };
    }
    
    return {
        status: isApproved ? 'Aprovada' : 'Reprovada',
        message: quorumMessage
    };
}


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
  
  const FONT = 'Helvetica'; // closest to Arial in jsPDF
  doc.setFont(FONT);

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
      doc.setFont(FONT, fontStyle);
      const lines = doc.splitTextToSize(text, maxWidth);
      
      checkPageBreak(lines.length * fontSize * 1.2);

      doc.text(lines, x, currentY);
      return currentY + lines.length * (doc.getLineHeight() / doc.internal.scaleFactor) * 0.8;
  };
  
  const formatDateTime = (date: Date) => format(date, "dd 'de' MMMM de yyyy, 'às' HH:mm'h'", { locale: ptBR });
  
  // --- Header ---
  y = printWrappedText(assembly.title.toUpperCase(), margin, y, contentWidth, { fontSize: 14, fontStyle: 'bold' });
  y += 5;
  if(assembly.startedAt) {
    y = printWrappedText(`Iniciada em: ${formatDateTime(assembly.startedAt.toDate())}`, margin, y, contentWidth, { fontSize: 10 });
  }
  y += 15;
  y = printWrappedText('Minuta de Ata', margin, y, contentWidth, { fontSize: 12, fontStyle: 'bold' });
  y += 5;
  y = printWrappedText(DISCLAIMER_TEXT, margin, y, contentWidth, { fontSize: 8 });
  y += 20;

  // --- Timeline Items ---
  const sortedTimeline = [...timelineItems].sort((a, b) => {
    const dateA = a.createdAt?.toDate() ?? new Date(0);
    const dateB = b.createdAt?.toDate() ?? new Date(0);
    return dateA.getTime() - dateB.getTime();
  });

  for (const item of sortedTimeline) {
      checkPageBreak(40);
      doc.setDrawColor(220); // Lighter gray line
      doc.line(margin, y, pageWidth - margin, y);
      y += 15;

      if ('question' in item) {
          const poll = item as Poll;
          const votes = allVotes[poll.id] || [];
          const options = allOptions[poll.id] || [];
          const optionMap = new Map(options.map((o) => [o.id, o.text]));
          const pollResult = getPollResult(poll, options, votes);
          
          y = printWrappedText(`VOTAÇÃO: ${poll.question}`, margin, y, contentWidth, { fontSize: 11, fontStyle: 'bold' });
          y += 5;
          const typeText = poll.type === 'proposal' ? 'Votação de Proposta' : 'Consulta de Opinião';
          y = printWrappedText(`Tipo: ${typeText}`, margin, y, contentWidth, { fontSize: 9 });
          y += 5;
          y = printWrappedText(`Período: ${formatDateTime(poll.createdAt.toDate())} a ${formatDateTime(poll.endDate.toDate())}`, margin, y, contentWidth, { fontSize: 9 });

          if (pollResult) {
            y+= 5;
            y = printWrappedText(`Resultado: ${pollResult.status}`, margin, y, contentWidth, { fontSize: 9, fontStyle: 'bold'});
            y = printWrappedText(`Detalhes: ${pollResult.message}`, margin, y, contentWidth, { fontSize: 9 });
          }

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
          }).sort((a, b) => (a[0] || '').localeCompare(b[0] || ''));

          const tableColumnWidths = [150, 160, 70, 150];
          const tableCellPadding = 5;
          const lineHeight = 12;

          // Header
          doc.setFontSize(9);
          doc.setFont(FONT, 'bold');
          checkPageBreak(lineHeight + tableCellPadding * 2);
          let currentX = margin;
          head[0].forEach((cell, i) => {
              doc.text(cell, currentX + tableCellPadding, y + lineHeight);
              currentX += tableColumnWidths[i];
          });
          y += lineHeight + tableCellPadding;
          doc.setDrawColor(200);
          doc.line(margin, y, pageWidth - margin, y);
          y += tableCellPadding;

          // Body
          doc.setFontSize(8);
          doc.setFont(FONT, 'normal');
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
              doc.setDrawColor(230);
              doc.line(margin, y - tableCellPadding, pageWidth - margin, y - tableCellPadding);
          });
          y += 10;
      } else {
          const ata = item as AtaItem;
          y = printWrappedText(ata.text, margin, y, contentWidth, { fontSize: 10 });
      }
  }

  // --- Footer ---
  checkPageBreak(80);
  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;
  if (assembly.endedAt) {
      y = printWrappedText(`Encerramento: ${formatDateTime(assembly.endedAt.toDate())}`, margin, y, contentWidth, { fontSize: 10 });
  }
  y += 30;

  y = printWrappedText(DISCLAIMER_TEXT, margin, y, contentWidth, { fontSize: 8 });

  doc.save(`Ata - ${assembly.title}.pdf`);
}


async function generateDocx(
  assembly: Assembly,
  timelineItems: (AtaItem | Poll)[],
  allVotes: Record<string, Vote[]>,
  allOptions: Record<string, PollOption[]>,
  userProfiles: Record<string, UserProfile>
) {
  const FONT = 'Arial';
  const formatDateTime = (date: Date) => format(date, "dd 'de' MMMM de yyyy, 'às' HH:mm'h'", { locale: ptBR });
  
  const children: (Paragraph | Table)[] = [];

  // --- Header ---
  children.push(
    new Paragraph({
      children: [new TextRun({ text: assembly.title.toUpperCase(), bold: true, font: FONT, size: 28 })],
      alignment: AlignmentType.LEFT,
    })
  );

  if (assembly.startedAt) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Iniciada em: ${formatDateTime(assembly.startedAt.toDate())}`, font: FONT, size: 20 })],
        alignment: AlignmentType.LEFT,
      })
    );
  }
  children.push(new Paragraph({}));
  
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Minuta de Ata', bold: true, font: FONT, size: 24 })],
      alignment: AlignmentType.LEFT,
    })
  );
  children.push(new Paragraph({
      children: [new TextRun({ text: DISCLAIMER_TEXT, font: FONT, size: 16, italics: true })],
      alignment: AlignmentType.LEFT,
  }));
  children.push(new Paragraph({}));


  // --- Timeline Items (chronological order) ---
  const sortedTimeline = [...timelineItems].sort((a, b) => {
    const dateA = a.createdAt?.toDate() ?? new Date(0);
    const dateB = b.createdAt?.toDate() ?? new Date(0);
    return dateA.getTime() - dateB.getTime();
  });

  for (const item of sortedTimeline) {
    children.push(new Paragraph({ text: '', style: 'line-spacing' }));

    if ('question' in item) {
      const poll = item as Poll;
      const votes = allVotes[poll.id] || [];
      const options = allOptions[poll.id] || [];
      const optionMap = new Map(options.map((o) => [o.id, o.text]));
      const pollResult = getPollResult(poll, options, votes);

      children.push(
        new Paragraph({
          children: [new TextRun({ text: `VOTAÇÃO: ${poll.question}`, bold: true, font: FONT, size: 22 })],
          alignment: AlignmentType.LEFT,
        })
      );
      
      const typeText = poll.type === 'proposal' ? 'Votação de Proposta' : 'Consulta de Opinião';
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Tipo: `, bold: true, font: FONT, size: 18 }),
            new TextRun({ text: typeText, font: FONT, size: 18 }),
          ],
          alignment: AlignmentType.LEFT,
        })
      );
      
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Período: ', font: FONT, size: 18, bold: true }),
            new TextRun({ text: `${formatDateTime(poll.createdAt.toDate())} a ${formatDateTime(poll.endDate.toDate())}`, font: FONT, size: 18 }),
          ],
          alignment: AlignmentType.LEFT,
        })
      );

      if (pollResult) {
          children.push(
              new Paragraph({
                  children: [
                      new TextRun({ text: `Resultado: `, bold: true, font: FONT, size: 18 }),
                      new TextRun({ text: pollResult.status, font: FONT, size: 18 }),
                  ],
                  alignment: AlignmentType.LEFT,
              })
          );
          children.push(
              new Paragraph({
                  children: [
                      new TextRun({ text: `Detalhes: `, bold: true, font: FONT, size: 18 }),
                      new TextRun({ text: pollResult.message, font: FONT, size: 18 }),
                  ],
                  alignment: AlignmentType.LEFT,
              })
          );
      }
      children.push(new Paragraph({}));

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
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      const tableRows = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'NOME', bold: true, font: FONT })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'EMAIL', bold: true, font: FONT })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'VOTO', bold: true, font: FONT })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'POR PROCURAÇÃO A', bold: true, font: FONT })] })] }),
          ],
        }),
        ...voterList.map(
          (voter) =>
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: voter.name, font: FONT })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: voter.email, font: FONT })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: voter.vote, font: FONT })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: voter.proxy || '', font: FONT })] })] }),
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
          children: [new TextRun({ text: ata.text, font: FONT, size: 20 })],
          alignment: AlignmentType.LEFT,
        })
      );
    }
  }

  // --- Footer ---
  children.push(new Paragraph({}));
  if (assembly.endedAt) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Encerramento: ${formatDateTime(assembly.endedAt.toDate())}`, font: FONT, size: 20 }),
        ],
        alignment: AlignmentType.LEFT,
      })
    );
  }
  children.push(new Paragraph({}));
  children.push(new Paragraph({
      children: [new TextRun({ text: DISCLAIMER_TEXT, font: FONT, size: 16, italics: true })],
      alignment: AlignmentType.LEFT,
  }));

  const doc = new Document({
    styles: {
        paragraphStyles: [
            {
                id: "line-spacing",
                name: "Line Spacing",
                basedOn: "Normal",
                next: "Normal",
                run: {
                    font: FONT,
                },
                paragraph: {
                    spacing: {
                        before: 100,
                        after: 100
                    },
                },
            },
        ],
    },
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, `Ata - ${assembly.title}.docx`);
  });
}
