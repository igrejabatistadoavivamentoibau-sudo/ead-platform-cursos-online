'use client'

import Link from 'next/link'
import Image from 'next/image'

interface CourseCardProps {
  id: string
  title: string
  description: string
  image: string
  instructor: string
  students: number
  price: number
}

export default function CourseCard({
  id,
  title,
  description,
  image,
  instructor,
  students,
  price,
}: CourseCardProps) {
  return (
    <Link href={`/courses/${id}`}>
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition cursor-pointer">
        <div className="relative h-48 w-full">
          <Image
            src={image || '/images/course-placeholder.jpg'}
            alt={title}
            fill
            className="object-cover"
          />
        </div>
        
        <div className="p-4">
          <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">{description}</p>
          
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-500">{instructor}</span>
            <span className="text-sm text-gray-500">{students} alunos</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold text-blue-600">
              R$ {price.toFixed(2)}
            </span>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
              Ver Curso
            </button>
          </div>
        </div>
      </div>
    </Link>
  )
}
