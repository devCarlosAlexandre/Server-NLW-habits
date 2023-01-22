import { FastifyInstance } from 'fastify'
import dayjs from 'dayjs'
import { z } from 'zod';
import { prisma } from "./lib/prisma";



export async function appRoutes(app: FastifyInstance) {
    app.post('/habits', async (request) => {
        const createHabitBody = z.object({
            title: z.string(),
            weekDays: z.array(
                z.number().min(0).max(6)
            )
        })
        const { title, weekDays } = createHabitBody.parse(request.body)

        const today = dayjs().startOf('day').toDate()

        await prisma.habit.create({
            data: {
                title,
                created_at: today,
                weekDays: {
                    create: weekDays.map(weekDay => {
                        return {
                            week_day: weekDay,
                        }
                    })
                }
            }
        })

    });

    app.get('/day', async (request) => {
        const getDayParams = z.object({
            date: z.coerce.date()
        })

        const { date } = getDayParams.parse(request.query)

        const parsedDate = dayjs(date).startOf('day')
        const weekDay = parsedDate.get('day')

        const possibleHabits = await prisma.habit.findMany({
            where: {
                created_at: {
                    lte: date,
                },
                weekDays: {
                    some: {
                        week_day: weekDay
                    }

                }
            }
        })

        const day = await prisma.day.findUnique({
            where: {
                date: parsedDate.toDate(),
            },
            include: {
                dayHabits: true
            }
        })

        const CompletedHabits = day?.dayHabits.map(dayHabit => {
            return dayHabit.day_id
        })


        return {
            possibleHabits,
            CompletedHabits
        }

    })

    app.patch('/habits/:id/toggle', async (request) => {
        //route param
        const toggleHabitParams = z.object({
            id: z.string().uuid(),
        })

        const { id } = toggleHabitParams.parse(request.params)

        const today = dayjs().startOf('day').toDate()

        let day = await prisma.day.findUnique({
            where: {
                date: today,
            }
        })

        if (!day) {
            day = await prisma.day.create({
                data: {
                    date: today,
                }
            })
        }

        const dayHabit = await prisma.dayHabit.findUnique({
            where: {
                day_id_habit_id: {
                    day_id: day.id,
                    habit_id: id
                }
            }
        })


        if (dayHabit) {
            //remove a marcação do habito
            await prisma.dayHabit.delete({
                where: {
                    id: dayHabit.id,
                }
            })
        } else {
            //completar o habito neste dia
            await prisma.dayHabit.create({
                data: {
                    day_id: day.id,
                    habit_id: id,
                }
            })
        }
    });

    app.get('/summary', async () => {
        // Query mais complexas, mais condições, relacionamento => SQL na mão
        // Prisma ORM: RAW SQL => SQLite

        const summary = await prisma.$queryRaw`
        SELECT * FROM days
        `;
        return summary;
    })

}