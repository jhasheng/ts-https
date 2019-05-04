import { createLogger as winstonLogger, format, transports } from 'winston'
import * as DailyRotateFile from 'winston-daily-rotate-file'

const { combine, timestamp, label, printf, colorize, uncolorize, splat } = format

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} ${level} [${label}]: ${message}`
});

export function createLogger(cate: string) {
  return winstonLogger({
    level: 'silly',
    format: combine(
      colorize(),
      label({ label: cate }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      splat(),
      myFormat
    ),
    transports: [
      new transports.Console(),
      new DailyRotateFile({
        dirname: 'logs',
        filename: '%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '100m',
        maxFiles: '1d',
        format: combine(uncolorize())
      })
    ]
  })
}