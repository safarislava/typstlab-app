import { 
  initDB, 
  projectRepository, 
  fileRepository, 
  userRepository 
} from '../services';
import { hashPassword } from '../services';

export type { TypstProject, DBTypstFile, DBUser } from '../core/types';

export {
  initDB,
  hashPassword
};

// Re-export repository methods for backward compatibility
export const getUserFromDB = userRepository.getUser.bind(userRepository);
export const saveUserToDB = userRepository.saveUser.bind(userRepository);

export const saveProjectToDB = projectRepository.save.bind(projectRepository);
export const deleteProjectFromDB = projectRepository.delete.bind(projectRepository);
export const getAllProjectsFromDB = projectRepository.getAll.bind(projectRepository);
export const getProjectsForUserFromDB = projectRepository.getByOwner.bind(projectRepository);
export const migrateLegacyProjectsToUser = projectRepository.migrateLegacyProjectsToUser.bind(projectRepository);

export const getFilesForProjectFromDB = fileRepository.getFilesForProject.bind(fileRepository);
export const saveFileToDB = fileRepository.saveFile.bind(fileRepository);
export const deleteFileFromDB = fileRepository.deleteFile.bind(fileRepository);
