import { Unit } from "@services/barion";

export type ProductRow = {
    $row: number,
    MainId: string
    Id: string,
    Category: string,
    Name: string,
    Description: string,
    Price: number,
    Unit?: Unit
}